import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { FinancialEntry, ValidationError, UPLOAD_TYPES, UploadType, ExclusionRule } from '@/types/financial';
import { addEntries, getRules } from '@/lib/storage';
import { Upload, AlertCircle, CheckCircle2, FileSpreadsheet, X, FileText, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface FileUploadProps {
  schoolId: string;
  onImported: () => void;
}

// Column name aliases for auto-mapping
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

function convertRows(
  rows: Record<string, any>[],
  uploadType: UploadType,
  schoolId: string,
  rules: ExclusionRule[],
  columnMapping: Record<string, string>
): { entries: FinancialEntry[]; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const entries: FinancialEntry[] = [];

  const get = (row: Record<string, any>, key: string) => {
    const rawKey = columnMapping[key];
    if (!rawKey) return undefined;
    // Try exact key first, then normalized
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
          };
          break;
        }
        case 'fluxo': {
          const dt = parseDate(get(row, 'data'));
          const val = parseNumber(get(row, 'valor'));
          const tipo = String(get(row, 'tipo') || '').toLowerCase().trim();
          if (!dt) { errors.push({ linha: lineNum, coluna: 'data', mensagem: 'Data inválida' }); return; }
          if (val == null) { errors.push({ linha: lineNum, coluna: 'valor', mensagem: 'Valor inválido' }); return; }
          if (tipo !== 'entrada' && tipo !== 'saida') {
            errors.push({ linha: lineNum, coluna: 'tipo', mensagem: 'Tipo deve ser "entrada" ou "saida"' }); return;
          }
          entry = {
            id: crypto.randomUUID(), data: dt, descricao: get(row, 'descricao') || '',
            valor: Math.abs(val), tipo: tipo as 'entrada' | 'saida', categoria: 'fluxo_realizado',
            origem: 'fluxo', school_id: schoolId,
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
  const [selectedType, setSelectedType] = useState<UploadType | null>(null);
  const [preview, setPreview] = useState<FinancialEntry[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [columnErrors, setColumnErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  // Column mapping state
  const [needsMapping, setNeedsMapping] = useState(false);
  const [unmappedCols, setUnmappedCols] = useState<string[]>([]);
  const [availableCols, setAvailableCols] = useState<string[]>([]);
  const [manualMapping, setManualMapping] = useState<Record<string, string>>({});
  const [pendingRows, setPendingRows] = useState<Record<string, any>[]>([]);
  const [currentMapping, setCurrentMapping] = useState<Record<string, string>>({});
  // PDF raw data for review
  const [pdfRawRows, setPdfRawRows] = useState<string[][] | null>(null);

  const processRows = useCallback((rows: Record<string, any>[], uploadType: UploadType, mapping: Record<string, string>) => {
    const rules = getRules(schoolId);
    const { entries, errors: validationErrors } = convertRows(rows, uploadType, schoolId, rules, mapping);
    setPreview(entries);
    setErrors(validationErrors);
    setNeedsMapping(false);
    setUnmappedCols([]);
    setPdfRawRows(null);
  }, [schoolId]);

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
        // Use first row as headers
        const headers = pdfRows[0];
        raw = pdfRows.slice(1).map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => {
            obj[h] = row[i] || '';
          });
          return obj;
        });
      } catch {
        setColumnErrors(['Erro ao ler PDF. Verifique se o arquivo contém dados tabulares.']);
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
      // Ask user for manual mapping
      setNeedsMapping(true);
      setUnmappedCols(unmapped);
      setAvailableCols(rawColumns);
      setManualMapping({});
      setPendingRows(raw);
      setCurrentMapping(mapping);
      return;
    }

    // Build full mapping (use normalized keys)
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

  const handleConfirm = () => {
    if (errors.length > 0 || preview.length === 0) return;
    addEntries(preview);
    setPreview([]);
    setErrors([]);
    setSelectedType(null);
    setFileName('');
    onImported();
  };

  const handleReset = () => {
    setPreview([]);
    setErrors([]);
    setColumnErrors([]);
    setSelectedType(null);
    setFileName('');
    setNeedsMapping(false);
    setPdfRawRows(null);
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

          {preview.length === 0 && columnErrors.length === 0 && !needsMapping && (
            <label className="glass-card rounded-xl p-8 border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors cursor-pointer flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-primary" />
              <span className="text-sm text-muted-foreground">
                Arraste ou clique para selecionar arquivo
              </span>
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

          {/* Column mapping UI */}
          {needsMapping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-secondary" />
                <h4 className="font-display font-semibold text-sm text-foreground">Mapeamento de Colunas</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                As seguintes colunas não foram encontradas automaticamente. Selecione a correspondência:
              </p>
              <div className="space-y-3">
                {unmappedCols.map(col => (
                  <div key={col} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground min-w-[140px]">{col}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    <select
                      value={manualMapping[col] || ''}
                      onChange={e => setManualMapping(prev => ({ ...prev, [col]: e.target.value }))}
                      className="flex-1 h-9 px-3 text-sm rounded-md bg-surface border border-border text-foreground"
                    >
                      <option value="">Selecionar coluna...</option>
                      {availableCols.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleMappingConfirm}
                disabled={!unmappedCols.every(c => manualMapping[c])}
                className="gradient-green text-primary-foreground"
              >
                Aplicar Mapeamento
              </Button>
            </motion.div>
          )}

          {/* PDF raw preview */}
          {pdfRawRows && !needsMapping && preview.length === 0 && columnErrors.length === 0 && (
            <div className="glass-card rounded-xl p-4 space-y-2">
              <h4 className="font-display font-semibold text-sm text-foreground">Dados extraídos do PDF</h4>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="text-xs w-full">
                  <tbody>
                    {pdfRawRows.slice(0, 15).map((row, i) => (
                      <tr key={i} className={i === 0 ? 'font-bold bg-surface' : 'border-t border-border/30'}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-1 whitespace-nowrap text-foreground">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Column errors */}
          <AnimatePresence>
            {columnErrors.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-2"
              >
                <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                  <AlertCircle className="w-4 h-4" />
                  Arquivo inválido ({fileName})
                </div>
                {columnErrors.map((e, i) => (
                  <p key={i} className="text-sm text-destructive/80 ml-6">• {e}</p>
                ))}
                <Button variant="ghost" size="sm" onClick={handleReset} className="text-destructive">
                  Tentar novamente
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-2 max-h-48 overflow-y-auto">
              <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                <AlertCircle className="w-4 h-4" />
                {errors.length} erro(s) encontrado(s) — importação bloqueada
              </div>
              {errors.slice(0, 20).map((e, i) => (
                <p key={i} className="text-xs text-destructive/80 ml-6">
                  Linha {e.linha}, coluna "{e.coluna}": {e.mensagem}
                </p>
              ))}
              {errors.length > 20 && (
                <p className="text-xs text-destructive/60 ml-6">...e mais {errors.length - 20} erros</p>
              )}
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">{preview.length} registros prontos para importação</span>
              </div>

              <div className="glass-card rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Descrição</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Valor</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((e, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="px-3 py-2 text-foreground">{e.data}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate text-foreground">{e.descricao}</td>
                        <td className={`px-3 py-2 text-right font-medium ${e.tipo === 'entrada' ? 'text-primary' : 'text-destructive'}`}>
                          {formatCurrency(e.valor)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            e.tipo === 'entrada' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                          }`}>
                            {e.tipo}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {errors.length === 0 && (
                <Button onClick={handleConfirm} className="w-full gradient-green text-primary-foreground">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirmar Importação ({preview.length} registros)
                </Button>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
