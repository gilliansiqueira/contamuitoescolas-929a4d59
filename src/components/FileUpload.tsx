import { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { FinancialEntry, ValidationError, UPLOAD_TYPES, UploadType, ExclusionRule, determineTipoRegistro, TypeClassification } from '@/types/financial';
import { useExclusionRules, useAddEntries, useAddUpload, useAddAuditLog, useTypeClassifications, useSaveTypeClassification } from '@/hooks/useFinancialData';
import { supabase } from '@/integrations/supabase/client';
import { parseSpreadsheetDate, toPreviousBusinessDay } from '@/lib/dateUtils';

// Tipos de upload que representam PROJEÇÃO de recebíveis/contas a pagar.
// Para esses tipos, um novo upload SUBSTITUI a projeção futura existente
// (a partir da menor data do novo arquivo) — preservando lançamentos manuais
// e tudo que estiver marcado como `realizado`.
const PROJECTION_REPLACE_TYPES = new Set(['sponte', 'cheque', 'cartao', 'contas_pagar']);
import { Upload, AlertCircle, CheckCircle2, FileSpreadsheet, X, FileText, ArrowRight, Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { normalizeTipo, classifyTipoName, defaultSinalFor, findClassification, type EffectiveClassification, getEffectiveClassification, calculateTotals } from '@/lib/classificationUtils';
import { TipoMappingStep, type TipoMappingRow } from '@/components/upload/TipoMappingStep';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { fetchSchoolTemplateId, fetchTemplateItems, type FinancialModelTemplateItem } from '@/lib/financialModels';
import { ImportacaoSponteAuditada } from '@/components/realizado/ImportacaoSponteAuditada';

interface FileUploadProps {
  schoolId: string;
  onImported: () => void;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  nome_aluno: ['sacado', 'aluno', 'nome', 'nome_sacado', 'nome_aluno', 'responsavel'],
  valor: ['valor_com_desconto', 'valor', 'vlr', 'total', 'valor_total', 'montante'],
  data_vencimento: ['data_vencimento', 'dt_vencimento', 'vencimento', 'data vencimento'],
  tipo_pagamento: ['forma_de_cobranca', 'forma_cobranca', 'tipo_pagamento', 'tipo pagamento', 'forma_pagamento', 'metodo'],
  data_compensacao: ['data_compensacao', 'dt_compensacao', 'compensacao', 'data compensacao'],
  data_recebimento: ['data_recebimento', 'dt_recebimento', 'recebimento', 'data recebimento'],
  parcelas: ['parcelas', 'num_parcelas', 'qtd_parcelas', 'parcela'],
  favorecido: ['favorecido', 'fornecedor', 'credor', 'beneficiario'],
  categoria: ['categoria', 'tipo_despesa', 'classificacao', 'grupo'],
  data: [
    'data', 'dt', 'date',
    'data_pagamento', 'data pagamento', 'dt_pagamento', 'dt pagamento',
    'data_movimento', 'data movimento', 'data_movimentacao', 'data movimentacao', 'data movimentação',
    'data_lancamento', 'data lancamento', 'data lançamento',
    'data_credito', 'data credito', 'data crédito',
    'data_competencia', 'data competencia', 'data competência', 'competencia', 'competência',
  ],
  descricao: ['descricao', 'desc', 'historico', 'observacao'],
  tipo: ['tipo', 'type', 'natureza'],
};

function parseDate(val: any): string | null {
  return parseSpreadsheetDate(val);
}

function parseNumber(val: any): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function applyRules(entry: FinancialEntry, rules: ExclusionRule[]): FinancialEntry | null {
  // IMPORTAÇÃO: nenhum registro é descartado. Todos os dados precisam ser
  // salvos integralmente. A regra de "ignorar" só vale em contextos de
  // cálculo (Fluxo de Caixa Realizado e Histórico Financeiro), não aqui.
  for (const rule of rules) {
    const fieldValue = rule.campo === 'descricao' ? entry.descricao : entry.categoria;
    const matches = rule.operador === 'contem'
      ? fieldValue.toLowerCase().includes(rule.valor.toLowerCase())
      : fieldValue.toLowerCase() === rule.valor.toLowerCase();
    if (matches) {
      if (rule.acao === 'recategorizar' && rule.novaCategoria) {
        return { ...entry, categoria: rule.novaCategoria };
      }
      // 'ignorar' não descarta mais — entry segue para o próximo passo.
    }
  }
  return entry;
}

function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

// Fields where, if multiple candidate columns are present, we must ask the user
// which one to use instead of silently picking the first match.
const AMBIGUOUS_FIELDS = new Set(['data', 'data_vencimento', 'data_compensacao', 'data_recebimento', 'valor']);

function autoMapColumns(rawColumns: string[], requiredColumns: string[]): { mapping: Record<string, string>; unmapped: string[] } {
  const mapping: Record<string, string> = {};
  const unmapped: string[] = [];
  for (const req of requiredColumns) {
    const aliases = COLUMN_ALIASES[req] || [req];
    const matches: string[] = [];
    for (const rawCol of rawColumns) {
      const normalized = normalizeColumnName(rawCol);
      if (aliases.some(a => normalizeColumnName(a) === normalized)) {
        matches.push(rawCol);
      }
    }
    if (matches.length === 1) {
      mapping[req] = matches[0];
    } else if (matches.length > 1 && AMBIGUOUS_FIELDS.has(req)) {
      // Ambiguous — force manual choice (e.g. valor vs valor_com_desconto)
      unmapped.push(req);
    } else if (matches.length >= 1) {
      mapping[req] = matches[0];
    } else {
      unmapped.push(req);
    }
  }
  return { mapping, unmapped };
}

/**
 * Classify a fluxo entry using type_classifications table first, then fallback.
 * Priority: 1) Type classification table  2) Text heuristic  3) Value sign
 */
function classifyFluxoEntry(
  tipoRaw: string,
  valor: number,
  classifications: TypeClassification[]
): { tipo: 'entrada' | 'saida'; tipoOriginal: string } {
  const tipoNorm = normalizeTipo(tipoRaw);
  const tipoOriginal = tipoRaw || (valor >= 0 ? 'entrada' : 'saida');

  // 1) Sinônimos canônicos + tabela de classificações (com normalização única)
  const resolved = classifyTipoName(tipoRaw, classifications);
  if (resolved === 'receita') return { tipo: 'entrada', tipoOriginal };
  if (resolved === 'despesa') return { tipo: 'saida', tipoOriginal };
  if (resolved === 'operacao' || resolved === 'ignorar') {
    // mantém o sinal do valor como pista para 'tipo' (entrada/saida no banco),
    // mas a classificação efetiva continua respeitando 'operacao'/'ignorar'.
    return { tipo: valor >= 0 ? 'entrada' : 'saida', tipoOriginal };
  }

  // 2) Fallback: sem texto de tipo → usa sinal do valor
  if (!tipoNorm) {
    return { tipo: valor >= 0 ? 'entrada' : 'saida', tipoOriginal };
  }

  // 3) Tipo desconhecido → usa sinal do valor (será tratado como 'operacao' depois)
  return { tipo: valor >= 0 ? 'entrada' : 'saida', tipoOriginal };
}

function convertRows(
  rows: Record<string, any>[],
  uploadType: UploadType,
  schoolId: string,
  rules: ExclusionRule[],
  columnMapping: Record<string, string>,
  classifications: TypeClassification[]
): { entries: FinancialEntry[]; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const entries: FinancialEntry[] = [];

  const get = (row: Record<string, any>, key: string) => {
    const rawKey = columnMapping[key];
    if (!rawKey) return undefined;
    if (row[rawKey] !== undefined) return row[rawKey];
    const normalizedKey = normalizeColumnName(rawKey);
    const matchKey = Object.keys(row).find(k => normalizeColumnName(k) === normalizedKey);
    return matchKey ? row[matchKey] : undefined;
  };

  rows.forEach((row, i) => {
    const lineNum = i + 2;
    let entry: FinancialEntry | null = null;

    try {
      switch (uploadType.key) {
        case 'sponte': {
          const dt = parseDate(get(row, 'data_vencimento'));
          const val = parseNumber(get(row, 'valor'));
          if (!dt) { errors.push({ linha: lineNum, coluna: 'data_vencimento', mensagem: 'Data inválida' }); return; }
          if (val == null) { errors.push({ linha: lineNum, coluna: 'valor', mensagem: 'Valor inválido' }); return; }
          entry = {
            id: crypto.randomUUID(), data: dt, descricao: `Recebimento - ${get(row, 'nome_aluno') || ''}`,
            valor: Math.abs(val), tipo: 'entrada', categoria: get(row, 'tipo_pagamento') || 'mensalidade',
            origem: 'sponte', school_id: schoolId,
            tipoRegistro: 'projetado',
            editadoManualmente: false,
          };
          break;
        }
        case 'cheque': {
          const dtRaw = parseDate(get(row, 'data_compensacao'));
          const val = parseNumber(get(row, 'valor'));
          if (!dtRaw) { errors.push({ linha: lineNum, coluna: 'data_compensacao', mensagem: 'Data inválida' }); return; }
          if (val == null) { errors.push({ linha: lineNum, coluna: 'valor', mensagem: 'Valor inválido' }); return; }
          const dt = toPreviousBusinessDay(dtRaw);
          entry = {
            id: crypto.randomUUID(), data: dt, descricao: `Cheque - ${get(row, 'nome_aluno') || ''}`,
            valor: Math.abs(val), tipo: 'entrada', categoria: 'cheque',
            origem: 'cheque', school_id: schoolId,
            tipoRegistro: 'projetado',
            editadoManualmente: false,
          };
          break;
        }
        case 'cartao': {
          const dtRaw = parseDate(get(row, 'data_recebimento'));
          const val = parseNumber(get(row, 'valor'));
          if (!dtRaw) { errors.push({ linha: lineNum, coluna: 'data_recebimento', mensagem: 'Data inválida' }); return; }
          if (val == null) { errors.push({ linha: lineNum, coluna: 'valor', mensagem: 'Valor inválido' }); return; }
          const dt = toPreviousBusinessDay(dtRaw);
          entry = {
            id: crypto.randomUUID(), data: dt, descricao: `Cartão`,
            valor: Math.abs(val), tipo: 'entrada', categoria: 'cartao',
            origem: 'cartao', school_id: schoolId,
            tipoRegistro: 'projetado',
            editadoManualmente: false,
          };
          break;
        }
        case 'contas_pagar': {
          const dtRaw = parseDate(get(row, 'data_vencimento'));
          const val = parseNumber(get(row, 'valor'));
          if (!dtRaw) { errors.push({ linha: lineNum, coluna: 'data_vencimento', mensagem: 'Data inválida' }); return; }
          if (val == null) { errors.push({ linha: lineNum, coluna: 'valor', mensagem: 'Valor inválido' }); return; }
          // Projeção nunca cai em fim de semana — antecipa para sexta.
          const dt = toPreviousBusinessDay(dtRaw);
          entry = {
            id: crypto.randomUUID(), data: dt, descricao: `Pagar - ${get(row, 'favorecido') || ''}`,
            valor: Math.abs(val), tipo: 'saida', categoria: get(row, 'categoria') || 'despesa',
            origem: 'contas_pagar', school_id: schoolId,
            tipoRegistro: 'projetado',
            editadoManualmente: false,
          };
          break;
        }
        case 'fluxo': {
          const dt = parseDate(get(row, 'data'));
          const val = parseNumber(get(row, 'valor'));
          const tipoRaw = String(get(row, 'tipo') || '').trim();
          if (!dt) { errors.push({ linha: lineNum, coluna: 'data', mensagem: 'Data inválida' }); return; }
          if (val == null) { errors.push({ linha: lineNum, coluna: 'valor', mensagem: 'Valor inválido' }); return; }

          const { tipo, tipoOriginal } = classifyFluxoEntry(tipoRaw, val, classifications);

          entry = {
            id: crypto.randomUUID(), data: dt, descricao: get(row, 'descricao') || '',
            valor: Math.abs(val), tipo, categoria: 'fluxo_realizado',
            origem: 'fluxo', school_id: schoolId,
            tipoOriginal,
            tipoRegistro: determineTipoRegistro(dt),
            editadoManualmente: false,
          };
          break;
        }
      }
    } catch {
      errors.push({ linha: lineNum, coluna: '-', mensagem: 'Erro ao processar linha' });
      return;
    }

    if (entry) {
      const processed = applyRules(entry, rules);
      if (processed) entries.push(processed);
    }
  });

  return { entries, errors };
}

async function extractPDFText(file: File): Promise<string[][]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const rows: string[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let currentLine: string[] = [];
    let lastY: number | null = null;
    for (const item of content.items) {
      if ('str' in item) {
        const y = Math.round((item as any).transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 3) {
          if (currentLine.length > 0) rows.push(currentLine);
          currentLine = [];
        }
        currentLine.push(item.str.trim());
        lastY = y;
      }
    }
    if (currentLine.length > 0) rows.push(currentLine);
  }
  return rows;
}

export function FileUpload({ schoolId, onImported }: FileUploadProps) {
  const { data: rules = [] } = useExclusionRules(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const addEntriesMut = useAddEntries();
  const addUploadMut = useAddUpload();
  const addAuditMut = useAddAuditLog();
  const saveClassificationMut = useSaveTypeClassification();

  const [selectedType, setSelectedType] = useState<UploadType | null>(null);
  const [preview, setPreview] = useState<FinancialEntry[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [columnErrors, setColumnErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [needsMapping, setNeedsMapping] = useState(false);
  const [unmappedCols, setUnmappedCols] = useState<string[]>([]);
  const [availableCols, setAvailableCols] = useState<string[]>([]);
  const [manualMapping, setManualMapping] = useState<Record<string, string>>({});
  const [pendingRows, setPendingRows] = useState<Record<string, any>[]>([]);
  const [currentMapping, setCurrentMapping] = useState<Record<string, string>>({});
  const [pdfRawRows, setPdfRawRows] = useState<string[][] | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { isAdmin } = useAuth();
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ data: '', descricao: '', valor: '', categoria: '' });
  const [savingManual, setSavingManual] = useState(false);

  const totals = useMemo(() => {
    return calculateTotals(preview, classifications);
  }, [preview, classifications]);

  // Modelo Financeiro da escola — fonte das categorias do lançamento manual.
  const { data: templateId } = useQuery({
    queryKey: ['schoolTemplateId', schoolId],
    queryFn: () => fetchSchoolTemplateId(schoolId),
    enabled: !!schoolId,
  });
  const { data: templateItems = [] } = useQuery({
    queryKey: ['templateItems', templateId],
    queryFn: () => fetchTemplateItems(templateId!),
    enabled: !!templateId,
  });
  const modelItems = useMemo<FinancialModelTemplateItem[]>(() => {
    const seen = new Set<string>();
    const out: FinancialModelTemplateItem[] = [];
    [...templateItems]
      .filter(it => it.tipo !== 'ignorar')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .forEach(it => {
        const key = normalizeTipo(it.name);
        if (seen.has(key)) return;
        seen.add(key);
        out.push(it);
      });
    return out;
  }, [templateItems]);

  const handleManualSave = async () => {
    if (!manual.data || !manual.descricao || !manual.valor || !manual.categoria) {
      toast.error('Preencha data, descrição, valor e categoria.');
      return;
    }
    const valorNum = parseNumber(manual.valor);
    if (valorNum == null) {
      toast.error('Valor inválido.');
      return;
    }
    const item = modelItems.find(it => it.name === manual.categoria);
    if (!item) {
      toast.error('Categoria não encontrada no Modelo Financeiro.');
      return;
    }
    const tipo: 'entrada' | 'saida' = item.tipo === 'entrada' ? 'entrada' : 'saida';
    setSavingManual(true);
    try {
      const entry: FinancialEntry = {
        id: crypto.randomUUID(),
        data: manual.data,
        descricao: manual.descricao,
        valor: Math.abs(valorNum),
        tipo,
        categoria: item.name,
        origem: 'manual',
        school_id: schoolId,
        tipoRegistro: determineTipoRegistro(manual.data),
        editadoManualmente: true,
      };
      await addEntriesMut.mutateAsync([entry]);

      // Espelha no Histórico Financeiro (fonte do Dashboard) — soma ao valor existente
      // do mesmo (school_id, month, tipo_valor); remove variantes para evitar fantasmas.
      const month = manual.data.slice(0, 7);
      const tipoKey = normalizeTipo(item.name);
      const { data: existingRows } = await supabase
        .from('historical_monthly' as any)
        .select('id, valor, tipo_valor')
        .eq('school_id', schoolId)
        .eq('month', month);
      const variants = (existingRows ?? []).filter((r: any) => normalizeTipo(r.tipo_valor) === tipoKey);
      const prevSum = variants.reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
      if (variants.length) {
        await supabase.from('historical_monthly' as any).delete().in('id', variants.map((r: any) => r.id));
      }
      await supabase.from('historical_monthly' as any).insert({
        school_id: schoolId,
        month,
        tipo_valor: tipoKey,
        valor: prevSum + Math.abs(valorNum),
      });

      await addAuditMut.mutateAsync({
        school_id: schoolId,
        action: 'manual_entry',
        description: `Lançamento manual (Projeção): ${entry.data} - ${entry.descricao} - ${entry.valor} [${item.name}]`,
      });
      toast.success('Lançamento manual adicionado.');
      setManual({ data: '', descricao: '', valor: '', categoria: '' });
      setManualOpen(false);
      onImported();
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err?.message ?? 'desconhecido'}`);
    } finally {
      setSavingManual(false);
    }
  };

  // Tipo-mapping step (apenas para uploadType.key === 'fluxo')
  const [tipoMapping, setTipoMapping] = useState<TipoMappingRow[] | null>(null);
  const [tipoMappingPending, setTipoMappingPending] = useState<{
    rows: Record<string, any>[];
    mapping: Record<string, string>;
    uploadType: UploadType;
  } | null>(null);

  const processRows = useCallback((rows: Record<string, any>[], uploadType: UploadType, mapping: Record<string, string>) => {
    // Para fluxo de caixa, exigir mapeamento por tipo antes de gerar entries
    if (uploadType.key === 'fluxo') {
      const tipoCol = mapping['tipo'];
      const counts = new Map<string, { label: string; count: number }>();
      for (const row of rows) {
        const raw = String((tipoCol ? row[tipoCol] : '') ?? '').trim();
        if (!raw) continue;
        const key = normalizeTipo(raw);
        const cur = counts.get(key);
        if (cur) cur.count += 1;
        else counts.set(key, { label: raw, count: 1 });
      }

      const modelKeys = new Set(modelItems.map(it => normalizeTipo(it.name)));
      const modelByKey = new Map(modelItems.map(it => [normalizeTipo(it.name), it]));

      const tipoRows: TipoMappingRow[] = Array.from(counts.entries())
        .map(([key, { label, count }]) => {
          const cfg = findClassification(label, classifications);
          const inModel = modelKeys.has(key);
          const modelItem = modelByKey.get(key);

          // Pré-preenche classificação SOMENTE se houver config existente OU o
          // tipo bater com um item do Modelo Financeiro. Caso contrário, deixa
          // vazio para forçar o usuário a classificar manualmente.
          let cls: TipoMappingRow['classificacao'] = '';
          let prefilled = false;
          if (cfg) {
            cls = cfg.classificacao as TipoMappingRow['classificacao'];
            prefilled = true;
          } else if (modelItem) {
            cls =
              modelItem.tipo === 'entrada' && modelItem.entra_no_resultado ? 'receita' :
              modelItem.tipo === 'saida' && modelItem.entra_no_resultado ? 'despesa' :
              modelItem.impacta_caixa ? 'operacao' :
              'ignorar';
            prefilled = true;
          }

          const sinalRaw = cfg?.operacaoSinal;
          const sinal: TipoMappingRow['operacaoSinal'] =
            sinalRaw === 'somar' || sinalRaw === 'subtrair'
              ? sinalRaw
              : cls
                ? defaultSinalFor(cls as EffectiveClassification)
                : 'somar';
          return {
            tipoValor: key,
            label,
            count,
            classificacao: cls,
            operacaoSinal: sinal,
            prefilled,
            inModel,
          };
        })
        .sort((a, b) => b.count - a.count);

      setTipoMapping(tipoRows);
      setTipoMappingPending({ rows, mapping, uploadType });
      setNeedsMapping(false);
      setUnmappedCols([]);
      setPdfRawRows(null);
      setPreview([]);
      setErrors([]);
      return;
    }

    const { entries, errors: validationErrors } = convertRows(rows, uploadType, schoolId, rules, mapping, classifications);
    setPreview(entries);
    setErrors(validationErrors);
    setNeedsMapping(false);
    setUnmappedCols([]);
    setPdfRawRows(null);

    if (entries.length === 0) {
      const sample = validationErrors.slice(0, 3)
        .map(e => `Linha ${e.linha}: ${e.coluna} — ${e.mensagem}`)
        .join(' | ');
      const detail = validationErrors.length
        ? `${validationErrors.length} linha(s) inválida(s). ${sample}`
        : 'Verifique se as colunas mapeadas contêm dados válidos (data e valor).';
      setColumnErrors([
        `Nenhum registro válido foi gerado a partir do arquivo. ${detail}`,
      ]);
      toast.error('Nenhum registro válido encontrado no arquivo.', {
        description: detail,
      });
    } else {
      toast.success(
        `${entries.length} registro(s) prontos para revisão${
          validationErrors.length ? ` (${validationErrors.length} ignorados)` : ''
        }.`
      );
    }
  }, [schoolId, rules, classifications, modelItems]);

  const handleFile = useCallback(async (file: File, uploadType: UploadType) => {
    setFileName(file.name);
    setPreview([]);
    setErrors([]);
    setColumnErrors([]);
    setNeedsMapping(false);
    setPdfRawRows(null);

    const isPDF = file.name.toLowerCase().endsWith('.pdf');
    let raw: Record<string, any>[] = [];

    if (isPDF) {
      try {
        const pdfRows = await extractPDFText(file);
        if (pdfRows.length < 2) {
          setColumnErrors(['Não foi possível extrair dados do PDF']);
          return;
        }
        setPdfRawRows(pdfRows);
        const headers = pdfRows[0];
        raw = pdfRows.slice(1).map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => { obj[h] = row[i] || ''; });
          return obj;
        });
      } catch {
        setColumnErrors(['Erro ao ler PDF.']);
        return;
      }
    } else {
      const buf = await file.arrayBuffer();
      // IMPORTANT: `raw: true` + `cellDates: false`. Sem isso, o parser de
      // CSV do XLSX autoconverte "01/07/2026" para serial Excel assumindo
      // locale americano (MM/DD/YYYY) — Jan/7 vira Jul/1 corrompido — e
      // "402,57" vira o inteiro 40257. Com raw:true, todos os valores
      // chegam como string bruta e o parseDate/parseNumber cuidam do
      // formato brasileiro corretamente.
      const wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: true });

      const ws = wb.Sheets[wb.SheetNames[0]];
      raw = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
    }

    if (raw.length === 0) {
      setColumnErrors(['Arquivo vazio']);
      return;
    }

    const rawColumns = Object.keys(raw[0]);
    const { mapping, unmapped } = autoMapColumns(rawColumns, uploadType.requiredColumns);

    if (unmapped.length > 0) {
      setNeedsMapping(true);
      setUnmappedCols(unmapped);
      setAvailableCols(rawColumns);
      setManualMapping({});
      setPendingRows(raw);
      setCurrentMapping(mapping);
      return;
    }

    const fullMapping: Record<string, string> = {};
    for (const req of uploadType.requiredColumns) {
      fullMapping[req] = mapping[req];
    }
    processRows(raw, uploadType, fullMapping);
  }, [schoolId, processRows]);

  const handleMappingConfirm = () => {
    if (!selectedType) return;
    const allMapped = unmappedCols.every(c => manualMapping[c]);
    if (!allMapped) return;
    const fullMapping = { ...currentMapping, ...manualMapping };
    processRows(pendingRows, selectedType, fullMapping);
  };

  /**
   * Aplica a classificação ao upload e salva automaticamente no banco (type_classifications).
   */
  const handleTipoMappingConfirm = async () => {
    if (!tipoMapping || !tipoMappingPending) return;
    if (!tipoMapping.every(r => !!r.classificacao)) {
      toast.error('Defina a classificação de todos os tipos antes de continuar.');
      return;
    }

    // Snapshot LOCAL — usado para converter as linhas deste arquivo e salvar no banco
    const localClassifications: TypeClassification[] = tipoMapping.map(r => {
      const cls = r.classificacao as EffectiveClassification;
      const existing = findClassification(r.label, classifications);
      return {
        id: existing?.id ?? crypto.randomUUID(),
        school_id: schoolId,
        tipoValor: r.tipoValor,
        classificacao: cls,
        operacaoSinal: cls === 'ignorar' ? defaultSinalFor(cls) : r.operacaoSinal,
        entraNoResultado: cls === 'receita' || cls === 'despesa',
        impactaCaixa: cls !== 'ignorar',
        label: existing?.label ?? r.label,
      };
    });

    // Salva automaticamente as classificações configuradas no Supabase
    try {
      for (const tc of localClassifications) {
        await saveClassificationMut.mutateAsync(tc);
      }
    } catch (err: any) {
      console.error('Erro ao salvar classificações no banco:', err);
      toast.error(`Falha ao salvar classificações no banco: ${err?.message ?? 'desconhecido'}`);
    }

    const { rows, mapping, uploadType } = tipoMappingPending;
    const { entries, errors: validationErrors } = convertRows(
      rows, uploadType, schoolId, rules, mapping, localClassifications
    );
    setPreview(entries);
    setErrors(validationErrors);
    setTipoMapping(null);
    setTipoMappingPending(null);

    if (entries.length === 0) {
      const sample = validationErrors.slice(0, 3)
        .map(e => `Linha ${e.linha}: ${e.coluna} — ${e.mensagem}`)
        .join(' | ');
      const detail = validationErrors.length
        ? `${validationErrors.length} linha(s) inválida(s). ${sample}`
        : 'Verifique se as colunas mapeadas contêm dados válidos.';
      setColumnErrors([`Nenhum registro válido foi gerado. ${detail}`]);
      toast.error('Nenhum registro válido após mapeamento.', { description: detail });
    } else {
      toast.success(`${entries.length} registro(s) prontos para revisão.`);
    }
  };

  /**
   * Opcional — quando o usuário clica em "Salvar como padrão",
   * persiste o mapeamento atual em type_classifications para uso em
   * futuros uploads (sem alterar lançamentos antigos).
   */
  const handleTipoMappingSaveAsDefault = async () => {
    if (!tipoMapping) return;
    if (!tipoMapping.every(r => !!r.classificacao)) {
      toast.error('Defina a classificação de todos os tipos antes de salvar.');
      return;
    }
    try {
      for (const r of tipoMapping) {
        const existing = findClassification(r.label, classifications);
        const cls = r.classificacao as EffectiveClassification;
        const tc: TypeClassification = {
          id: existing?.id ?? crypto.randomUUID(),
          school_id: schoolId,
          tipoValor: r.tipoValor,
          classificacao: cls,
          operacaoSinal: cls === 'ignorar' ? defaultSinalFor(cls) : r.operacaoSinal,
          entraNoResultado: cls === 'receita' || cls === 'despesa',
          impactaCaixa: cls !== 'ignorar',
          label: existing?.label ?? r.label,
        };
        await saveClassificationMut.mutateAsync(tc);
      }
      toast.success('Mapeamento salvo como padrão para próximos uploads.');
    } catch (err: any) {
      toast.error(`Erro ao salvar como padrão: ${err?.message ?? 'desconhecido'}`);
    }
  };

  const handleTipoMappingCancel = () => {
    setTipoMapping(null);
    setTipoMappingPending(null);
  };

  // Diálogo de substituição parcial para uploads de projeção
  const [replaceDialog, setReplaceDialog] = useState<{
    open: boolean;
    cutoff: string;
    existingCount: number;
    minNewDate: string;
  } | null>(null);

  const performImport = async (cutoffDate: string | null) => {
    if (!selectedType) return;
    setIsUploading(true);
    try {
      const uploadId = crypto.randomUUID();
      const entriesWithUploadId = preview.map(e => ({ ...e, origem_upload_id: uploadId }));

      // SUBSTITUIÇÃO DE PROJEÇÃO: para uploads de recebíveis/contas a pagar,
      // remove projeções antigas da MESMA origem a partir de cutoffDate.
      // cutoffDate = null → não remove nada (apenas adiciona).
      // cutoffDate = '0000-01-01' → remove todas as projeções desta origem.
      // Preserva lançamentos manuais e qualquer entrada marcada como 'realizado'.
      let removedCount = 0;
      if (PROJECTION_REPLACE_TYPES.has(selectedType.key) && cutoffDate) {
        // Floor de segurança: nunca apaga projeções anteriores a hoje (a menos que o usuário tenha
        // pedido explicitamente "Substituir tudo" com o sentinel 0000-01-01).
        const today = new Date().toISOString().slice(0, 10);
        const effectiveCutoff = cutoffDate === '0000-01-01'
          ? cutoffDate
          : (cutoffDate < today ? today : cutoffDate);
        const { data: deleted, error: delErr } = await supabase
          .from('financial_entries')
          .delete()
          .eq('school_id', schoolId)
          .eq('origem', selectedType.key)
          .eq('tipo_registro', 'projetado')
          .eq('editado_manualmente', false)
          .gte('data', effectiveCutoff)
          .select('id');
        if (delErr) throw delErr;
        removedCount = deleted?.length ?? 0;
      }

      // Cria o registro de upload ANTES das entradas para satisfazer a FK
      // financial_entries.origem_upload_id → upload_records.id
      await addUploadMut.mutateAsync({
        id: uploadId,
        school_id: schoolId,
        fileName,
        tipo: selectedType.key,
        uploadedAt: new Date().toISOString(),
        recordCount: preview.length,
      });
      await addEntriesMut.mutateAsync(entriesWithUploadId);

      // CONSOLIDAÇÃO AUTOMÁTICA para Fluxo (realizado)
      let consolidatedMonths = 0;
      if (selectedType.key === 'fluxo') {
        try {
          const monthsInUpload = Array.from(new Set(preview.map(e => e.data.slice(0, 7))));
          const { data: closures } = await supabase
            .from('period_closures')
            .select('month')
            .eq('school_id', schoolId)
            .eq('module', 'realizado')
            .eq('status', 'closed')
            .in('month', monthsInUpload);
          const closedSet = new Set((closures || []).map((c: any) => c.month));
          const histRows: Array<{ school_id: string; month: string; tipo_valor: string; valor: number }> = [];
          for (const m of monthsInUpload) {
            if (closedSet.has(m)) continue;
            let receitas = 0, despesas = 0;
            for (const e of preview.filter(x => x.data.startsWith(m))) {
              const cls = getEffectiveClassification(e, classifications);
              if (cls === 'receita') receitas += e.valor;
              else if (cls === 'despesa') despesas += e.valor;
            }
            if (receitas > 0) histRows.push({ school_id: schoolId, month: m, tipo_valor: 'Receita', valor: receitas });
            if (despesas > 0) histRows.push({ school_id: schoolId, month: m, tipo_valor: 'Despesa', valor: despesas });
          }
          if (histRows.length > 0) {
            const { error: histErr } = await supabase
              .from('historical_monthly')
              .upsert(histRows as any, { onConflict: 'school_id,month,tipo_valor' });
            if (histErr) console.error('Falha ao consolidar Histórico Financeiro:', histErr);
            else consolidatedMonths = new Set(histRows.map(r => r.month)).size;
          }
        } catch (consErr) {
          console.error('Erro consolidando histórico:', consErr);
        }
      }

      const replaceNote = removedCount > 0
        ? ` — substituiu ${removedCount} projeção(ões) a partir de ${cutoffDate}`
        : '';
      const consNote = consolidatedMonths > 0
        ? ` — consolidou ${consolidatedMonths} mês(es) no Histórico Financeiro`
        : '';
      await addAuditMut.mutateAsync({
        school_id: schoolId,
        action: 'upload',
        description: `Upload "${fileName}" (${selectedType.label}) - ${preview.length} registros${replaceNote}${consNote}`,
      });
      setPreview([]);
      setErrors([]);
      setSelectedType(null);
      setFileName('');
      onImported();
      const skipped = errors.length > 0 ? ` (${errors.length} linhas com erro ignoradas)` : '';
      const replaced = removedCount > 0 ? ` Substituiu ${removedCount} projeção(ões) anterior(es).` : '';
      const consolidatedTxt = consolidatedMonths > 0 ? ` ${consolidatedMonths} mês(es) consolidado(s) no histórico.` : '';
      toast.success(`${preview.length} registros importados!${skipped}${replaced}${consolidatedTxt}`);
    } catch (err: any) {
      console.error('Erro ao salvar dados:', err);
      toast.error(`Erro ao salvar dados: ${err?.message ?? 'desconhecido'}`);
    } finally {
      setIsUploading(false);
      setReplaceDialog(null);
    }
  };

  const handleConfirm = async () => {
    if (!selectedType) {
      toast.error('Selecione o tipo de arquivo antes de importar.');
      return;
    }
    if (preview.length === 0) {
      toast.error('Nenhum registro válido para importar.');
      return;
    }

    // Para tipos de projeção, verifica se já existem projeções no banco e abre diálogo.
    if (PROJECTION_REPLACE_TYPES.has(selectedType.key)) {
      const projetadas = preview.filter(e => e.tipoRegistro === 'projetado');
      const minNewDate = projetadas.length > 0
        ? projetadas.reduce((min, e) => (e.data < min ? e.data : min), projetadas[0].data)
        : preview.reduce((min, e) => (e.data < min ? e.data : min), preview[0].data);
      // Cutoff seguro: nunca anterior a hoje — protege qualquer projeção que já tenha virado realizado.
      const today = new Date().toISOString().slice(0, 10);
      const safeCutoff = minNewDate < today ? today : minNewDate;
      const { count } = await supabase
        .from('financial_entries')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('origem', selectedType.key)
        .eq('tipo_registro', 'projetado')
        .eq('editado_manualmente', false);
      if ((count ?? 0) > 0) {
        setReplaceDialog({ open: true, cutoff: safeCutoff, existingCount: count ?? 0, minNewDate });
        return;
      }
    }

    await performImport(null);
  };


  const handleReset = () => {
    setPreview([]);
    setErrors([]);
    setColumnErrors([]);
    setSelectedType(null);
    setFileName('');
    setNeedsMapping(false);
    setPdfRawRows(null);
    setTipoMapping(null);
    setTipoMappingPending(null);
  };

  function formatCurrency(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  return (
    <div className="space-y-4">
      {!selectedType ? (
        <div className="space-y-4">
          {isAdmin && (
            <div className="glass-card rounded-xl p-4 space-y-3 border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm text-foreground">Lançamento Manual (Projeção)</span>
                  <span className="text-[10px] uppercase tracking-wide bg-primary/10 text-primary rounded px-1.5 py-0.5">Admin</span>
                </div>
                <Button size="sm" variant={manualOpen ? 'ghost' : 'outline'} onClick={() => setManualOpen(o => !o)}>
                  {manualOpen ? 'Fechar' : 'Adicionar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use para lançar valores avulsos (rendimentos, ajustes, previsões) — aceita datas passadas ou futuras.
              </p>
              {manualOpen && (
                modelItems.length === 0 ? (
                  <p className="text-xs text-destructive pt-2">
                    Nenhum Modelo Financeiro aplicado a esta escola. Configure em Configurações → Modelo Financeiro antes de lançar manualmente.
                  </p>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 pt-2">
                  <select
                    value={manual.categoria}
                    onChange={e => setManual(m => ({ ...m, categoria: e.target.value }))}
                    className="h-9 border rounded px-2 text-sm bg-background lg:col-span-2"
                  >
                    <option value="">Selecione a categoria…</option>
                    {modelItems.map(it => (
                      <option key={it.id} value={it.name}>
                        {it.name} ({it.tipo === 'entrada' ? 'Entrada' : 'Saída'})
                      </option>
                    ))}
                  </select>
                  <Input type="date" value={manual.data} onChange={e => setManual(m => ({ ...m, data: e.target.value }))} className="h-9" />
                  <Input placeholder="Descrição" value={manual.descricao} onChange={e => setManual(m => ({ ...m, descricao: e.target.value }))} className="h-9 lg:col-span-2" />
                  <Input placeholder="Valor (ex: 1.500,50)" value={manual.valor} onChange={e => setManual(m => ({ ...m, valor: e.target.value }))} className="h-9" />
                  <Button size="sm" onClick={handleManualSave} disabled={savingManual} className="lg:col-span-6">
                    {savingManual ? 'Salvando...' : 'Salvar lançamento'}
                  </Button>
                </div>
                )
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {UPLOAD_TYPES.map((ut, i) => (
              <motion.button
                key={ut.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedType(ut)}
                className="glass-card rounded-xl p-5 text-left hover:border-primary/50 transition-all group"
              >
                <FileSpreadsheet className="w-6 h-6 text-primary mb-2 group-hover:scale-110 transition-transform" />
                <h4 className="font-display font-semibold text-sm text-foreground">{ut.label}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Colunas: {ut.requiredColumns.join(', ')}
                </p>
              </motion.button>
            ))}
          </div>
        </div>
      ) : selectedType.key === 'sponte' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <ImportacaoSponteAuditada
            schoolId={schoolId}
            onClose={handleReset}
            onImported={() => { onImported(); }}
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-foreground">{selectedType.label}</h3>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="rounded-xl border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <strong>Conferir lançamentos manuais antes de importar.</strong> Verifique se valores que você lançou manualmente
              (rendimentos, ajustes, previsões) não já estão presentes neste arquivo, para evitar duplicidade.
            </div>
          </div>

          {tipoMapping && (
            <TipoMappingStep
              rows={tipoMapping}
              onChange={setTipoMapping}
              onConfirm={handleTipoMappingConfirm}
              onCancel={handleTipoMappingCancel}
              onSaveAsDefault={handleTipoMappingSaveAsDefault}
            />
          )}

          {preview.length === 0 && columnErrors.length === 0 && !needsMapping && !tipoMapping && (
            <label className="glass-card rounded-xl p-8 border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors cursor-pointer flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-primary" />
              <span className="text-sm text-muted-foreground">Arraste ou clique para selecionar arquivo</span>
              <span className="text-xs text-muted-foreground">
                <FileSpreadsheet className="w-3 h-3 inline mr-1" />Excel/CSV
                <span className="mx-2">•</span>
                <FileText className="w-3 h-3 inline mr-1" />PDF
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f, selectedType);
                }}
              />
            </label>
          )}

          {needsMapping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium text-sm">Mapeamento manual necessário</span>
              </div>
              <p className="text-xs text-muted-foreground">
                As seguintes colunas não foram identificadas automaticamente. Selecione a coluna correspondente no arquivo:
              </p>
              {unmappedCols.map(col => (
                <div key={col} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-40">{col}:</span>
                  <select
                    value={manualMapping[col] || ''}
                    onChange={ev => setManualMapping(m => ({ ...m, [col]: ev.target.value }))}
                    className="flex-1 h-9 border rounded px-2 text-sm bg-background"
                  >
                    <option value="">Selecione...</option>
                    {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
              <Button onClick={handleMappingConfirm} disabled={!unmappedCols.every(c => manualMapping[c])} size="sm">
                <ArrowRight className="w-4 h-4 mr-1" /> Confirmar Mapeamento
              </Button>
            </motion.div>
          )}

          {columnErrors.length > 0 && (
            <div className="glass-card rounded-xl p-4 border-destructive/30 bg-destructive/5">
              <div className="flex items-center gap-2 text-destructive mb-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium text-sm">Erro na estrutura do arquivo</span>
              </div>
              <ul className="text-xs text-destructive/80 space-y-1">
                {columnErrors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}

          {preview.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium text-sm">{preview.length} registros prontos</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-primary font-semibold">
                    Receitas: {formatCurrency(totals.receitas)}
                  </span>
                  <span className="text-destructive font-semibold">
                    Despesas: {formatCurrency(totals.despesas)}
                  </span>
                </div>
              </div>

              {errors.length > 0 && (
                <div className="glass-card rounded-xl p-3 bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50">
                  <p className="text-xs font-medium text-amber-700 mb-1">{errors.length} linhas com erro (ignoradas):</p>
                  <div className="max-h-24 overflow-y-auto text-xs text-amber-600 space-y-0.5">
                    {errors.slice(0, 10).map((e, i) => <p key={i}>Linha {e.linha}: {e.coluna} - {e.mensagem}</p>)}
                    {errors.length > 10 && <p>... e mais {errors.length - 10}</p>}
                  </div>
                </div>
              )}

              <div className="glass-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Registro</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Descrição</th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 50).map(e => {
                        const cls = getEffectiveClassification(e, classifications);
                        const isRec = cls === 'receita';
                        const isDes = cls === 'despesa';
                        const isOp = cls === 'operacao';
                        return (
                          <tr key={e.id} className="border-t border-border/30">
                            <td className="px-3 py-1.5 text-foreground">{e.data}</td>
                            <td className="px-3 py-1.5">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                isRec ? 'bg-primary/10 text-primary' : isDes ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                              }`}>
                                {isRec ? 'Receita' : isDes ? 'Despesa' : isOp ? 'Operação' : 'Ignorado'}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                e.tipoRegistro === 'realizado' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {e.tipoRegistro === 'realizado' ? 'Realizado' : 'Projetado'}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[200px]">{e.descricao}</td>
                            <td className={`px-3 py-1.5 text-right font-semibold ${isRec ? 'text-primary' : isDes ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {formatCurrency(e.valor)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={handleReset}>Cancelar</Button>
                <Button size="sm" onClick={handleConfirm} disabled={isUploading}>
                  {isUploading ? 'Salvando...' : `Importar ${preview.length} registros`}
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Diálogo de substituição parcial de projeção */}
      {replaceDialog?.open && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-xl p-6 max-w-md w-full space-y-4 border border-border">
            <div>
              <h3 className="font-display font-semibold text-foreground">Já existe projeção para esta origem</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Encontramos <strong>{replaceDialog.existingCount}</strong> projeção(ões) anterior(es) desta origem.
                Escolha como tratar o novo arquivo. Lançamentos manuais e tudo que já virou
                <strong> realizado</strong> serão sempre preservados.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Substituir a partir de (somente futuro):</label>
              <Input
                type="date"
                value={replaceDialog.cutoff}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setReplaceDialog(d => d ? { ...d, cutoff: e.target.value } : d)}
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">
                Sugerido: <strong>{replaceDialog.minNewDate}</strong> (menor data do novo arquivo).
                Datas anteriores a hoje são bloqueadas para não afetar o realizado.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <Button variant="ghost" size="sm" onClick={() => setReplaceDialog(null)} disabled={isUploading}>
                Cancelar
              </Button>
              <Button variant="outline" size="sm" onClick={() => performImport(null)} disabled={isUploading}>
                Somar ao existente
              </Button>
              <Button variant="outline" size="sm" onClick={() => performImport('0000-01-01')} disabled={isUploading}>
                Substituir projeção inteira
              </Button>
              <Button size="sm" onClick={() => performImport(replaceDialog.cutoff)} disabled={isUploading || !replaceDialog.cutoff}>
                {isUploading ? 'Salvando...' : 'Substituir a partir da data'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

