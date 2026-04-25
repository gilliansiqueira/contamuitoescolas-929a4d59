import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { FinancialEntry, ValidationError, UPLOAD_TYPES, UploadType, ExclusionRule, determineTipoRegistro } from '@/types/financial';
import { useExclusionRules, useAddEntries, useAddUpload, useAddAuditLog, useTypeClassifications, useSaveTypeClassification } from '@/hooks/useFinancialData';
import { Upload, AlertCircle, CheckCircle2, FileSpreadsheet, X, FileText, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { TypeClassification } from '@/types/financial';
import { normalizeTipo, classifyTipoName, defaultSinalFor, findClassification } from '@/lib/classificationUtils';
import { TipoMappingStep, type TipoMappingRow } from '@/components/upload/TipoMappingStep';

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
  data: ['data', 'dt', 'date'],
  descricao: ['descricao', 'desc', 'historico', 'observacao'],
  tipo: ['tipo', 'type', 'natureza'],
};

function parseDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d+$/.test(s)) {
    const d = new Date((Number(s) - 25569) * 86400000);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  return null;
}

function parseNumber(val: any): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function applyRules(entry: FinancialEntry, rules: ExclusionRule[]): FinancialEntry | null {
  for (const rule of rules) {
    const fieldValue = rule.campo === 'descricao' ? entry.descricao : entry.categoria;
    const matches = rule.operador === 'contem'
      ? fieldValue.toLowerCase().includes(rule.valor.toLowerCase())
      : fieldValue.toLowerCase() === rule.valor.toLowerCase();
    if (matches) {
      if (rule.acao === 'ignorar') return null;
      if (rule.acao === 'recategorizar' && rule.novaCategoria) {
        return { ...entry, categoria: rule.novaCategoria };
      }
    }
  }
  return entry;
}

function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function autoMapColumns(rawColumns: string[], requiredColumns: string[]): { mapping: Record<string, string>; unmapped: string[] } {
  const mapping: Record<string, string> = {};
  const unmapped: string[] = [];
  for (const req of requiredColumns) {
    const aliases = COLUMN_ALIASES[req] || [req];
    let found = false;
    for (const rawCol of rawColumns) {
      const normalized = normalizeColumnName(rawCol);
      if (aliases.some(a => normalizeColumnName(a) === normalized)) {
        mapping[req] = rawCol;
        found = true;
        break;
      }
    }
    if (!found) unmapped.push(req);
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
          const dt = parseDate(get(row, 'data_compensacao'));
          const val = parseNumber(get(row, 'valor'));
          if (!dt) { errors.push({ linha: lineNum, coluna: 'data_compensacao', mensagem: 'Data inválida' }); return; }
          if (val == null) { errors.push({ linha: lineNum, coluna: 'valor', mensagem: 'Valor inválido' }); return; }
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
          const dt = parseDate(get(row, 'data_recebimento'));
          const val = parseNumber(get(row, 'valor'));
          if (!dt) { errors.push({ linha: lineNum, coluna: 'data_recebimento', mensagem: 'Data inválida' }); return; }
          if (val == null) { errors.push({ linha: lineNum, coluna: 'valor', mensagem: 'Valor inválido' }); return; }
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
          const dt = parseDate(get(row, 'data_vencimento'));
          const val = parseNumber(get(row, 'valor'));
          if (!dt) { errors.push({ linha: lineNum, coluna: 'data_vencimento', mensagem: 'Data inválida' }); return; }
          if (val == null) { errors.push({ linha: lineNum, coluna: 'valor', mensagem: 'Valor inválido' }); return; }
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

      const tipoRows: TipoMappingRow[] = Array.from(counts.entries())
        .map(([key, { label, count }]) => {
          const cfg = findClassification(label, classifications);
          const cls = (cfg?.classificacao as TipoMappingRow['classificacao']) ?? 'despesa';
          const sinalRaw = cfg?.operacaoSinal;
          const sinal: TipoMappingRow['operacaoSinal'] =
            sinalRaw === 'somar' || sinalRaw === 'subtrair' ? sinalRaw : defaultSinalFor(cls);
          return {
            tipoValor: key,
            label,
            count,
            classificacao: cls,
            operacaoSinal: sinal,
            prefilled: !!cfg,
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
  }, [schoolId, rules, classifications]);

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
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
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
   * Aplica a classificação SOMENTE a este upload (não persiste em type_classifications).
   * Cada upload é independente — o mesmo "tipo" pode ter classificação diferente.
   */
  const handleTipoMappingConfirm = () => {
    if (!tipoMapping || !tipoMappingPending) return;
    if (!tipoMapping.every(r => !!r.classificacao)) {
      toast.error('Defina a classificação de todos os tipos antes de continuar.');
      return;
    }

    // Snapshot LOCAL — usado apenas para converter as linhas deste arquivo.
    // Não toca a tabela type_classifications.
    const localClassifications: TypeClassification[] = tipoMapping.map(r => ({
      id: crypto.randomUUID(),
      school_id: schoolId,
      tipoValor: r.label, // mantém o label original; classifyTipoName normaliza na leitura
      classificacao: r.classificacao,
      operacaoSinal: r.classificacao === 'ignorar' ? defaultSinalFor(r.classificacao) : r.operacaoSinal,
      entraNoResultado: r.classificacao === 'receita' || r.classificacao === 'despesa',
      impactaCaixa: r.classificacao !== 'ignorar',
      label: r.label,
    }));

    const { rows, mapping, uploadType } = tipoMappingPending;
    const { entries, errors: validationErrors } = convertRows(
      rows, uploadType, schoolId, rules, mapping, localClassifications
    );
    setPreview(entries);
    setErrors(validationErrors);
    setTipoMapping(null);
    setTipoMappingPending(null);
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
        const tc: TypeClassification = {
          id: existing?.id ?? crypto.randomUUID(),
          school_id: schoolId,
          tipoValor: r.tipoValor,
          classificacao: r.classificacao,
          operacaoSinal: r.classificacao === 'ignorar' ? defaultSinalFor(r.classificacao) : r.operacaoSinal,
          entraNoResultado: r.classificacao === 'receita' || r.classificacao === 'despesa',
          impactaCaixa: r.classificacao !== 'ignorar',
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

  const handleConfirm = async () => {
    if (!selectedType) {
      toast.error('Selecione o tipo de arquivo antes de importar.');
      return;
    }
    if (preview.length === 0) {
      toast.error('Nenhum registro válido para importar.');
      return;
    }
    setIsUploading(true);
    try {
      const uploadId = crypto.randomUUID();
      const entriesWithUploadId = preview.map(e => ({ ...e, origem_upload_id: uploadId }));
      await addEntriesMut.mutateAsync(entriesWithUploadId);
      await addUploadMut.mutateAsync({
        id: uploadId,
        school_id: schoolId,
        fileName,
        tipo: selectedType.key,
        uploadedAt: new Date().toISOString(),
        recordCount: preview.length,
      });
      await addAuditMut.mutateAsync({
        school_id: schoolId,
        action: 'upload',
        description: `Upload "${fileName}" (${selectedType.label}) - ${preview.length} registros`,
      });
      setPreview([]);
      setErrors([]);
      setSelectedType(null);
      setFileName('');
      onImported();
      const skipped = errors.length > 0 ? ` (${errors.length} linhas com erro ignoradas)` : '';
      toast.success(`${preview.length} registros importados com sucesso!${skipped}`);
    } catch (err: any) {
      console.error('Erro ao salvar dados:', err);
      toast.error(`Erro ao salvar dados: ${err?.message ?? 'desconhecido'}`);
    } finally {
      setIsUploading(false);
    }
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
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-foreground">{selectedType.label}</h3>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <X className="w-4 h-4" />
            </Button>
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
                    Entradas: {formatCurrency(preview.filter(e => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0))}
                  </span>
                  <span className="text-destructive font-semibold">
                    Saídas: {formatCurrency(preview.filter(e => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0))}
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
                      {preview.slice(0, 50).map(e => (
                        <tr key={e.id} className="border-t border-border/30">
                          <td className="px-3 py-1.5 text-foreground">{e.data}</td>
                          <td className="px-3 py-1.5">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              e.tipo === 'entrada' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                            }`}>
                              {e.tipo === 'entrada' ? 'Entrada' : 'Saída'}
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
                          <td className={`px-3 py-1.5 text-right font-semibold ${e.tipo === 'entrada' ? 'text-primary' : 'text-destructive'}`}>
                            {formatCurrency(e.valor)}
                          </td>
                        </tr>
                      ))}
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
    </div>
  );
}
