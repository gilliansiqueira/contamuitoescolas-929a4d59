import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, Plus, Check, X, AlertTriangle, ArrowRight, ArrowLeft, Columns, Eye, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';

interface Props {
  schoolId: string;
}

type Step = 'idle' | 'mapping' | 'preview';

const MAPPING_STORAGE_KEY = 'importacao_column_mapping';

const FIELD_DEFS = [
  { key: 'data', label: 'Data', required: true, aliases: ['data', 'date', 'dt', 'data_pagamento', 'data_vencimento', 'data pagamento', 'data vencimento', 'dtpagto', 'dtpag'] },
  { key: 'valor', label: 'Valor', required: true, aliases: ['valor', 'value', 'vlr', 'total', 'montante', 'amount', 'vl', 'val'] },
  { key: 'descricao', label: 'Descrição', required: false, aliases: ['descricao', 'descrição', 'desc', 'historico', 'histórico', 'detalhes', 'observacao', 'obs', 'memo', 'description'] },
  { key: 'categoria', label: 'Categoria', required: false, aliases: ['categoria', 'category', 'cat', 'conta', 'account', 'tipo', 'classificacao', 'grupo', 'class'] },
] as const;

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizeStr(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function parseDate(raw: any): string | null {
  if (!raw && raw !== 0) return null;
  let s = String(raw).trim();

  // Handle Excel serial dates
  if (/^\d{5}$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(Number(s));
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }

  // Strip time portion
  s = s.replace(/\s+\d{1,2}:\d{2}(:\d{2})?.*$/, '');

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    if (parts[2]?.length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    if (parts[0]?.length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  return null;
}

function parseValue(raw: any): number | null {
  if (typeof raw === 'number') return raw;
  if (!raw) return null;
  const s = String(raw).replace(/[R$\s]/g, '').trim();
  if (!s) return null;

  // Detect Brazilian format: 1.234,56
  let cleaned = s;
  if (/\d\.\d{3}/.test(s) && s.includes(',')) {
    cleaned = s.replace(/\./g, '').replace(',', '.');
  } else {
    cleaned = s.replace(',', '.');
  }
  cleaned = cleaned.replace(/[^\d.\-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function suggestColumn(fieldAliases: readonly string[], columns: string[]): string | undefined {
  const norm = columns.map(c => ({ orig: c, norm: normalizeStr(c) }));
  for (const alias of fieldAliases) {
    const match = norm.find(n => n.norm === alias);
    if (match) return match.orig;
  }
  // Partial match
  for (const alias of fieldAliases) {
    const match = norm.find(n => n.norm.includes(alias) || alias.includes(n.norm));
    if (match) return match.orig;
  }
  return undefined;
}

function loadSavedMapping(): Record<string, string> {
  try {
    const saved = localStorage.getItem(MAPPING_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

function saveMappingToStorage(mapping: Record<string, string>) {
  try { localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mapping)); } catch {}
}

export function ImportacaoRealizado({ schoolId }: Props) {
  const queryClient = useQueryClient();

  // Steps
  const [step, setStep] = useState<Step>('idle');
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ data: '', descricao: '', valor: '', categoria: '' });

  // File data
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');

  // Column mapping
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Processed data
  const [preview, setPreview] = useState<any[]>([]);
  const [invalidCount, setInvalidCount] = useState(0);
  const [unmapped, setUnmapped] = useState<{ categoria: string }[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<Record<string, string>>({});

  const { data: contas = [] } = useQuery({
    queryKey: ['chart_of_accounts', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('chart_of_accounts').select('*').eq('school_id', schoolId).order('grupo').order('nome');
      if (error) throw error;
      return data;
    },
  });

  const categoriaFilhas = useMemo(() => contas.filter(c => c.nivel > 1), [contas]);

  const insertMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const mapped = rows.map(r => ({
        school_id: schoolId,
        data: r.data,
        descricao: r.descricao || '',
        valor: Math.abs(r.valor),
        tipo: 'despesa',
        conta_codigo: '',
        conta_nome: r.categoria || '',
        complemento: '',
        origem_arquivo: r.origem_arquivo || 'manual',
      }));
      const batchSize = 500;
      for (let i = 0; i < mapped.length; i += batchSize) {
        const batch = mapped.slice(i, i + batchSize);
        const { error } = await supabase.from('realized_entries').insert(batch);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['realized_entries', schoolId] });
      toast.success('Lançamentos importados com sucesso');
      resetAll();
    },
    onError: () => toast.error('Erro ao importar lançamentos'),
  });

  function resetAll() {
    setStep('idle');
    setRawRows([]);
    setFileColumns([]);
    setFileName('');
    setColumnMapping({});
    setPreview([]);
    setInvalidCount(0);
    setUnmapped([]);
    setCategoryMappings({});
  }

  // Step 1: Read file
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws);

        if (rows.length === 0) {
          toast.error('Arquivo vazio');
          return;
        }

        const cols = Object.keys(rows[0]);
        setRawRows(rows);
        setFileColumns(cols);

        // Auto-suggest mapping using saved + aliases
        const saved = loadSavedMapping();
        const autoMapping: Record<string, string> = {};
        for (const field of FIELD_DEFS) {
          // Try saved mapping first
          if (saved[field.key] && cols.includes(saved[field.key])) {
            autoMapping[field.key] = saved[field.key];
          } else {
            const suggested = suggestColumn(field.aliases, cols);
            if (suggested) autoMapping[field.key] = suggested;
          }
        }
        setColumnMapping(autoMapping);
        setStep('mapping');
        toast.success(`${rows.length} linhas encontradas com ${cols.length} colunas`);
      } catch {
        toast.error('Erro ao ler arquivo');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }, []);

  // Step 2: Process with mapping → preview
  const processMapping = useCallback(() => {
    if (!columnMapping.data || !columnMapping.valor) {
      toast.error('Mapeie pelo menos Data e Valor');
      return;
    }

    saveMappingToStorage(columnMapping);

    const knownNorm = new Set(contas.map(c => normalizeStr(c.nome)));
    let invalid = 0;

    const parsed = rawRows.map(r => {
      const dataCol = columnMapping.data;
      const valorCol = columnMapping.valor;
      const descCol = columnMapping.descricao;
      const catCol = columnMapping.categoria;

      const data = parseDate(r[dataCol]);
      const valor = parseValue(r[valorCol]);

      if (!data || valor === null || valor === 0) {
        invalid++;
        return null;
      }

      const descricao = descCol ? String(r[descCol] || '').trim() : '';
      const categoria = catCol ? String(r[catCol] || '').trim() : '';

      return { data, descricao, valor: Math.abs(valor), categoria, origem_arquivo: fileName };
    }).filter(Boolean) as any[];

    // Check unmapped categories
    const unmappedCats: { categoria: string }[] = [];
    const seen = new Set<string>();
    parsed.forEach(r => {
      if (r.categoria) {
        const norm = normalizeStr(r.categoria);
        if (!knownNorm.has(norm) && !seen.has(norm)) {
          unmappedCats.push({ categoria: r.categoria });
          seen.add(norm);
        }
      }
    });

    setPreview(parsed);
    setInvalidCount(invalid);
    setUnmapped(unmappedCats);
    setCategoryMappings({});
    setStep('preview');

    if (parsed.length === 0) toast.error('Nenhum registro válido após processamento');
    else toast.success(`${parsed.length} lançamentos válidos`);
  }, [columnMapping, rawRows, contas, fileName]);

  const handleConfirmImport = () => {
    const final = preview.map(r => {
      const mapped = categoryMappings[normalizeStr(r.categoria)];
      return { ...r, categoria: mapped || r.categoria };
    });
    insertMutation.mutate(final);
  };

  const handleManualAdd = () => {
    if (!manual.data || !manual.valor) {
      toast.error('Data e valor são obrigatórios');
      return;
    }
    insertMutation.mutate([{
      data: manual.data,
      descricao: manual.descricao,
      valor: Math.abs(parseFloat(manual.valor.replace(',', '.')) || 0),
      categoria: manual.categoria,
      origem_arquivo: 'manual',
    }]);
    setManual({ data: '', descricao: '', valor: '', categoria: '' });
    setShowManual(false);
  };

  // --- RENDER ---
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Importação de Lançamentos</CardTitle>
          <div className="flex gap-2">
            {step === 'idle' && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowManual(!showManual)}>
                  <Plus className="w-4 h-4 mr-1" /> Manual
                </Button>
                <label>
                  <Button size="sm" asChild>
                    <span><Upload className="w-4 h-4 mr-1" /> Importar Arquivo</span>
                  </Button>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
                </label>
              </>
            )}
            {step !== 'idle' && (
              <Button size="sm" variant="ghost" onClick={resetAll}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Steps indicator */}
          {step !== 'idle' && (
            <div className="flex items-center gap-2 mb-4 text-xs">
              <StepIndicator n={1} label="Arquivo" active={step === 'mapping'} done={step === 'preview'} />
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <StepIndicator n={2} label="Mapeamento" active={step === 'mapping'} done={step === 'preview'} />
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <StepIndicator n={3} label="Preview" active={step === 'preview'} done={false} />
            </div>
          )}

          {/* Manual entry */}
          <AnimatePresence>
            {showManual && step === 'idle' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-lg border border-border bg-muted/30">
                  <Input type="date" value={manual.data} onChange={e => setManual(m => ({ ...m, data: e.target.value }))} />
                  <Input placeholder="Descrição" value={manual.descricao} onChange={e => setManual(m => ({ ...m, descricao: e.target.value }))} />
                  <Input placeholder="Valor" value={manual.valor} onChange={e => setManual(m => ({ ...m, valor: e.target.value }))} />
                  <Select value={manual.categoria} onValueChange={v => setManual(m => ({ ...m, categoria: v }))}>
                    <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      {categoriaFilhas.map(c => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1 col-span-2 sm:col-span-4">
                    <Button size="sm" onClick={handleManualAdd} disabled={insertMutation.isPending} className="flex-1">
                      <Check className="w-4 h-4 mr-1" /> Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowManual(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* STEP: Column Mapping */}
          <AnimatePresence mode="wait">
            {step === 'mapping' && (
              <motion.div key="mapping" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="mb-3">
                  <p className="text-sm font-medium flex items-center gap-2 mb-1">
                    <Columns className="w-4 h-4" />
                    Mapeamento de Colunas — <span className="text-muted-foreground">{fileName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Selecione qual coluna do arquivo corresponde a cada campo. Colunas similares são sugeridas automaticamente.
                  </p>
                </div>

                <div className="space-y-3 mb-4">
                  {FIELD_DEFS.map(field => (
                    <div key={field.key} className="flex items-center gap-3">
                      <div className="min-w-[100px] flex items-center gap-1.5">
                        <span className="text-sm font-medium">{field.label}</span>
                        {field.required && <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">obrigatório</Badge>}
                      </div>
                      <Select
                        value={columnMapping[field.key] || ''}
                        onValueChange={v => setColumnMapping(prev => ({ ...prev, [field.key]: v === '__none__' ? '' : v }))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecionar coluna..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Não mapear —</SelectItem>
                          {fileColumns.map(col => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                {/* Sample data from file */}
                <div className="mb-4 rounded-lg border border-border overflow-hidden">
                  <p className="text-xs text-muted-foreground px-3 py-2 bg-muted/50 font-medium">
                    Amostra do arquivo ({rawRows.length} linhas)
                  </p>
                  <div className="max-h-32 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {fileColumns.slice(0, 6).map(col => (
                            <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rawRows.slice(0, 3).map((r, i) => (
                          <TableRow key={i}>
                            {fileColumns.slice(0, 6).map(col => (
                              <TableCell key={col} className="text-xs py-1 whitespace-nowrap max-w-[120px] truncate">
                                {String(r[col] ?? '—')}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={resetAll}>Cancelar</Button>
                  <Button
                    size="sm"
                    onClick={processMapping}
                    disabled={!columnMapping.data || !columnMapping.valor}
                  >
                    <Eye className="w-4 h-4 mr-1" /> Visualizar Dados
                  </Button>
                </div>
              </motion.div>
            )}

            {/* STEP: Preview */}
            {step === 'preview' && (
              <motion.div key="preview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      {preview.length} lançamentos válidos
                    </p>
                    {invalidCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {invalidCount} linhas ignoradas (sem data ou valor)
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setStep('mapping')}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                    </Button>
                    <Button size="sm" onClick={handleConfirmImport} disabled={insertMutation.isPending || preview.length === 0}>
                      {insertMutation.isPending ? 'Importando...' : (
                        <><CheckCircle2 className="w-4 h-4 mr-1" /> Importar {preview.length}</>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Unmapped categories */}
                {unmapped.length > 0 && (
                  <div className="mb-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2 text-yellow-700">
                      <AlertTriangle className="w-4 h-4" />
                      Categorias não reconhecidas ({unmapped.length})
                    </p>
                    <p className="text-xs text-muted-foreground">Associe ao plano de contas ou deixe em branco para manter o nome original.</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {unmapped.map(u => (
                        <div key={u.categoria} className="flex items-center gap-2">
                          <span className="text-xs font-medium min-w-[100px] truncate">{u.categoria}</span>
                          <span className="text-xs text-muted-foreground">→</span>
                          <Select value={categoryMappings[normalizeStr(u.categoria)] || ''} onValueChange={v => setCategoryMappings(prev => ({ ...prev, [normalizeStr(u.categoria)]: v }))}>
                            <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Manter original" /></SelectTrigger>
                            <SelectContent>
                              {categoriaFilhas.map(c => <SelectItem key={c.id} value={c.nome}>{c.grupo} → {c.nome}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Data preview table */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Data</TableHead>
                          <TableHead className="text-xs">Descrição</TableHead>
                          <TableHead className="text-xs text-right">Valor</TableHead>
                          <TableHead className="text-xs">Categoria</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.slice(0, 15).map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs py-1.5">{r.data}</TableCell>
                            <TableCell className="text-xs py-1.5 max-w-[150px] truncate">{r.descricao || '—'}</TableCell>
                            <TableCell className="text-xs py-1.5 text-right">{formatCurrency(r.valor)}</TableCell>
                            <TableCell className="text-xs py-1.5">{r.categoria || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {preview.length > 15 && (
                    <p className="text-xs text-muted-foreground text-center py-2 bg-muted/30">
                      ...e mais {preview.length - 15} lançamentos
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Idle help */}
          {step === 'idle' && !showManual && (
            <div className="text-xs text-muted-foreground space-y-1 p-3 rounded-lg bg-muted/30">
              <p className="font-medium">Como funciona:</p>
              <p>1. Importe um arquivo CSV ou Excel</p>
              <p>2. Mapeie as colunas do seu arquivo (data, valor, etc.)</p>
              <p>3. Visualize e confirme os dados antes de importar</p>
              <p className="mt-2 text-muted-foreground/70">O sistema lembra o último mapeamento usado e sugere automaticamente colunas com nomes parecidos.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StepIndicator({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 ${active ? 'text-primary font-medium' : done ? 'text-primary/60' : 'text-muted-foreground'}`}>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
        done ? 'bg-primary/20 text-primary' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      }`}>
        {done ? <Check className="w-3 h-3" /> : n}
      </span>
      <span className="text-xs">{label}</span>
    </div>
  );
}
