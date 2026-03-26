import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { FinancialEntry, ValidationError, UPLOAD_TYPES, UploadType, ExclusionRule } from '@/types/financial';
import { addEntries, getRules, deleteEntries } from '@/lib/storage';
import { Upload, AlertCircle, CheckCircle2, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface FileUploadProps {
  schoolId: string;
  onImported: () => void;
}

function parseDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try DD/MM/YYYY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // Excel serial
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

function convertRows(
  rows: Record<string, any>[],
  uploadType: UploadType,
  schoolId: string,
  rules: ExclusionRule[]
): { entries: FinancialEntry[]; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const entries: FinancialEntry[] = [];

  rows.forEach((row, i) => {
    const lineNum = i + 2;
    let entry: FinancialEntry | null = null;

    try {
      switch (uploadType.key) {
        case 'sponte': {
          const dt = parseDate(row.data_vencimento);
          const val = parseNumber(row.valor);
          if (!dt) { errors.push({ linha: lineNum, coluna: 'data_vencimento', mensagem: 'Data inválida' }); return; }
          if (val == null) { errors.push({ linha: lineNum, coluna: 'valor', mensagem: 'Valor inválido' }); return; }
          entry = {
            id: crypto.randomUUID(), data: dt, descricao: `Recebimento - ${row.nome_aluno || ''}`,
            valor: Math.abs(val), tipo: 'entrada', categoria: row.tipo_pagamento || 'mensalidade',
            origem: 'sponte', school_id: schoolId,
          };
          break;
        }
        case 'cheque': {
          const dt = parseDate(row.data_compensacao);
          const val = parseNumber(row.valor);
          if (!dt) { errors.push({ linha: lineNum, coluna: 'data_compensacao', mensagem: 'Data inválida' }); return; }
          if (val == null) { errors.push({ linha: lineNum, coluna: 'valor', mensagem: 'Valor inválido' }); return; }
          entry = {
            id: crypto.randomUUID(), data: dt, descricao: `Cheque - ${row.nome_aluno || ''}`,
            valor: Math.abs(val), tipo: 'entrada', categoria: 'cheque',
            origem: 'cheque', school_id: schoolId,
          };
          break;
        }
        case 'cartao': {
          const dt = parseDate(row.data_recebimento);
          const val = parseNumber(row.valor);
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
          const dt = parseDate(row.data_vencimento);
          const val = parseNumber(row.valor);
          if (!dt) { errors.push({ linha: lineNum, coluna: 'data_vencimento', mensagem: 'Data inválida' }); return; }
          if (val == null) { errors.push({ linha: lineNum, coluna: 'valor', mensagem: 'Valor inválido' }); return; }
          entry = {
            id: crypto.randomUUID(), data: dt, descricao: `Pagar - ${row.favorecido || ''}`,
            valor: Math.abs(val), tipo: 'saida', categoria: row.categoria || 'despesa',
            origem: 'contas_pagar', school_id: schoolId,
          };
          break;
        }
        case 'fluxo': {
          const dt = parseDate(row.data);
          const val = parseNumber(row.valor);
          const tipo = String(row.tipo || '').toLowerCase().trim();
          if (!dt) { errors.push({ linha: lineNum, coluna: 'data', mensagem: 'Data inválida' }); return; }
          if (val == null) { errors.push({ linha: lineNum, coluna: 'valor', mensagem: 'Valor inválido' }); return; }
          if (tipo !== 'entrada' && tipo !== 'saida') {
            errors.push({ linha: lineNum, coluna: 'tipo', mensagem: 'Tipo deve ser "entrada" ou "saida"' }); return;
          }
          entry = {
            id: crypto.randomUUID(), data: dt, descricao: row.descricao || '',
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

export function FileUpload({ schoolId, onImported }: FileUploadProps) {
  const [selectedType, setSelectedType] = useState<UploadType | null>(null);
  const [preview, setPreview] = useState<FinancialEntry[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [columnErrors, setColumnErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');

  const handleFile = useCallback(async (file: File, uploadType: UploadType) => {
    setFileName(file.name);
    setPreview([]);
    setErrors([]);
    setColumnErrors([]);

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (raw.length === 0) {
      setColumnErrors(['Arquivo vazio']);
      return;
    }

    // Normalize column names
    const normalized = raw.map(row => {
      const newRow: Record<string, any> = {};
      Object.keys(row).forEach(k => {
        newRow[normalizeColumnName(k)] = row[k];
      });
      return newRow;
    });

    // Check required columns
    const cols = Object.keys(normalized[0]);
    const missing = uploadType.requiredColumns.filter(c => !cols.includes(c));
    if (missing.length > 0) {
      setColumnErrors(missing.map(c => `Coluna "${c}" não encontrada`));
      return;
    }

    const rules = getRules(schoolId);
    const { entries, errors: validationErrors } = convertRows(normalized, uploadType, schoolId, rules);

    setPreview(entries);
    setErrors(validationErrors);
  }, [schoolId]);

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
              <h4 className="font-display font-semibold text-sm">{ut.label}</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Colunas: {ut.requiredColumns.join(', ')}
              </p>
            </motion.button>
          ))}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold">{selectedType.label}</h3>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {preview.length === 0 && columnErrors.length === 0 && (
            <label className="glass-card rounded-xl p-8 border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors cursor-pointer flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-primary" />
              <span className="text-sm text-muted-foreground">
                Arraste ou clique para selecionar arquivo Excel
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f, selectedType);
                }}
              />
            </label>
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
                <span className="font-medium">{preview.length} registros prontos para importação</span>
              </div>

              <div className="glass-card rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Descrição</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Valor</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((e, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="px-3 py-2">{e.data}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate">{e.descricao}</td>
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
