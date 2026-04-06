import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Plus, Check, X, AlertTriangle, ArrowRight, ArrowLeft, Columns, Eye, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';

interface Props { schoolId: string; }
type Step = 'idle' | 'mapping' | 'preview';

const MAPPING_STORAGE_KEY = 'importacao_column_mapping';

const FIELD_DEFS = [
  { key: 'data', label: 'Data', required: true, aliases: ['data', 'date', 'dt', 'data_pagamento', 'data_vencimento', 'data pagamento', 'dtpagto'] },
  { key: 'valor', label: 'Valor', required: true, aliases: ['valor', 'value', 'vlr', 'total', 'montante', 'amount', 'vl', 'val'] },
  { key: 'descricao', label: 'Descrição', required: false, aliases: ['descricao', 'descrição', 'desc', 'historico', 'histórico', 'detalhes', 'observacao', 'obs', 'description'] },
  { key: 'categoria', label: 'Categoria', required: true, aliases: ['categoria', 'category', 'cat', 'conta', 'account', 'tipo', 'classificacao', 'grupo', 'class', 'conta_nome'] },
] as const;

function normalizeStr(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function parseDate(raw: any): string | null {
  if (!raw && raw !== 0) return null;
  let s = String(raw).trim();
  if (/^\d{5}$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(Number(s));
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
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
  for (const alias of fieldAliases) {
    const match = norm.find(n => n.norm.includes(alias) || alias.includes(n.norm));
    if (match) return match.orig;
  }
  return undefined;
}

function loadSavedMapping(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(MAPPING_STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveMappingToStorage(mapping: Record<string, string>) {
  try { localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mapping)); } catch {}
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ImportacaoRealizado({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('idle');
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ data: '', descricao: '', valor: '', categoria: '' });
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<any[]>([]);
  const [invalidCount, setInvalidCount] = useState(0);
  const [unmapped, setUnmapped] = useState<{ categoria: string }[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<Record<string, string>>({});
  const [newCatMappings, setNewCatMappings] = useState<Record<string, { nome: string; grupo: string }>>({});

  const { data: contas = [] } = useQuery({
    queryKey: ['chart_of_accounts', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('chart_of_accounts').select('*').eq('school_id', schoolId).order('grupo').order('nome');
      if (error) throw error;
      return data;
    },
  });

  const categoriaFilhas = useMemo(() => contas.filter(c => c.nivel > 1), [contas]);
  const groupNames = useMemo(() => [...new Set(contas.filter(c => c.nivel === 1).map(c => c.grupo))], [contas]);

  const insertMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      // First create any new categories
      for (const [normKey, nc] of Object.entries(newCatMappings)) {
        if (nc.nome && nc.grupo) {
          await supabase.from('chart_of_accounts').insert({
            school_id: schoolId, codigo: '', nome: nc.nome, tipo: 'despesa', grupo: nc.grupo, nivel: 2, pai_id: null,
          });
        }
      }

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
        const { error } = await supabase.from('realized_entries').insert(mapped.slice(i, i + batchSize));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['realized_entries', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['chart_of_accounts', schoolId] });
      toast.success('Lançamentos importados com sucesso');
      resetAll();
    },
    onError: () => toast.error('Erro ao importar lançamentos'),
  });

  function resetAll() {
    setStep('idle'); setRawRows([]); setFileColumns([]); setFileName('');
    setColumnMapping({}); setPreview([]); setInvalidCount(0);
    setUnmapped([]); setCategoryMappings({}); setNewCatMappings({});
  }

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
        if (rows.length === 0) { toast.error('Arquivo vazio'); return; }
        const cols = Object.keys(rows[0]);
        setRawRows(rows); setFileColumns(cols);
        const saved = loadSavedMapping();
        const autoMapping: Record<string, string> = {};
        for (const field of FIELD_DEFS) {
          if (saved[field.key] && cols.includes(saved[field.key])) autoMapping[field.key] = saved[field.key];
          else { const s = suggestColumn(field.aliases, cols); if (s) autoMapping[field.key] = s; }
        }
        setColumnMapping(autoMapping);
        setStep('mapping');
        toast.success(`${rows.length} linhas encontradas`);
      } catch { toast.error('Erro ao ler arquivo'); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }, []);

  const processMapping = useCallback(() => {
    if (!columnMapping.data || !columnMapping.valor || !columnMapping.categoria) {
      toast.error('Mapeie Data, Valor e Categoria');
      return;
    }
    saveMappingToStorage(columnMapping);
    const knownNorm = new Set(contas.map(c => normalizeStr(c.nome)));
    let invalid = 0;

    const parsed = rawRows.map(r => {
      const data = parseDate(r[columnMapping.data]);
      const valor = parseValue(r[columnMapping.valor]);
      const catRaw = String(r[columnMapping.categoria] || '').trim();

      if (!data || valor === null || valor === 0) { invalid++; return null; }
      if (!catRaw) { invalid++; return null; } // sem categoria → não importar

      const descricao = columnMapping.descricao ? String(r[columnMapping.descricao] || '').trim() : '';
      return { data, descricao, valor: Math.abs(valor), categoria: catRaw, origem_arquivo: fileName };
    }).filter(Boolean) as any[];

    const unmappedCats: { categoria: string }[] = [];
    const seen = new Set<string>();
    parsed.forEach(r => {
      const norm = normalizeStr(r.categoria);
      if (!knownNorm.has(norm) && !seen.has(norm)) {
        unmappedCats.push({ categoria: r.categoria });
        seen.add(norm);
      }
    });

    setPreview(parsed); setInvalidCount(invalid);
    setUnmapped(unmappedCats); setCategoryMappings({}); setNewCatMappings({});
    setStep('preview');
    if (parsed.length === 0) toast.error('Nenhum registro válido');
    else toast.success(`${parsed.length} lançamentos válidos`);
  }, [columnMapping, rawRows, contas, fileName]);

  const handleConfirmImport = () => {
    // Check all unmapped are resolved
    const unresolved = unmapped.filter(u => {
      const norm = normalizeStr(u.categoria);
      return !categoryMappings[norm] && !newCatMappings[norm];
    });
    if (unresolved.length > 0) {
      toast.error(`Resolva todas as categorias não reconhecidas (${unresolved.length} pendentes)`);
      return;
    }

    const final = preview.map(r => {
      const norm = normalizeStr(r.categoria);
      const mapped = categoryMappings[norm];
      const newCat = newCatMappings[norm];
      return { ...r, categoria: mapped || newCat?.nome || r.categoria };
    });
    insertMutation.mutate(final);
  };

  const handleManualAdd = () => {
    if (!manual.data || !manual.valor || !manual.categoria) {
      toast.error('Data, valor e categoria são obrigatórios');
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

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Importação de Lançamentos</CardTitle>
          <div className="flex gap-2">
            {step === 'idle' && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowManual(!showManual)} className="rounded-xl">
                  <Plus className="w-4 h-4 mr-1" /> Manual
                </Button>
                <label>
                  <Button size="sm" asChild className="rounded-xl">
                    <span><Upload className="w-4 h-4 mr-1" /> Importar Arquivo</span>
                  </Button>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
                </label>
              </>
            )}
            {step !== 'idle' && (
              <Button size="sm" variant="ghost" onClick={resetAll} className="rounded-xl">
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl border border-border bg-muted/30">
                  <Input type="date" value={manual.data} onChange={e => setManual(m => ({ ...m, data: e.target.value }))} className="rounded-xl" />
                  <Input placeholder="Descrição" value={manual.descricao} onChange={e => setManual(m => ({ ...m, descricao: e.target.value }))} className="rounded-xl" />
                  <Input placeholder="Valor" value={manual.valor} onChange={e => setManual(m => ({ ...m, valor: e.target.value }))} className="rounded-xl" />
                  <Select value={manual.categoria} onValueChange={v => setManual(m => ({ ...m, categoria: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Categoria *" /></SelectTrigger>
                    <SelectContent>
                      {categoriaFilhas.map(c => <SelectItem key={c.id} value={c.nome}>{c.grupo} → {c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1 col-span-2 sm:col-span-4">
                    <Button size="sm" onClick={handleManualAdd} disabled={insertMutation.isPending} className="flex-1 rounded-xl">
                      <Check className="w-4 h-4 mr-1" /> Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowManual(false)} className="rounded-xl">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mapping step */}
          <AnimatePresence mode="wait">
            {step === 'mapping' && (
              <motion.div key="mapping" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="mb-3">
                  <p className="text-sm font-medium flex items-center gap-2 mb-1">
                    <Columns className="w-4 h-4" />
                    Mapeamento — <span className="text-muted-foreground">{fileName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Selecione qual coluna corresponde a cada campo.</p>
                </div>
                <div className="space-y-3 mb-4">
                  {FIELD_DEFS.map(field => (
                    <div key={field.key} className="flex items-center gap-3">
                      <div className="min-w-[100px] flex items-center gap-1.5">
                        <span className="text-sm font-medium">{field.label}</span>
                        {field.required && <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 rounded-md">obrigatório</Badge>}
                      </div>
                      <Select
                        value={columnMapping[field.key] || ''}
                        onValueChange={v => setColumnMapping(prev => ({ ...prev, [field.key]: v === '__none__' ? '' : v }))}
                      >
                        <SelectTrigger className="flex-1 rounded-xl"><SelectValue placeholder="Selecionar coluna..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Não mapear —</SelectItem>
                          {fileColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <div className="mb-4 rounded-xl border border-border overflow-hidden">
                  <p className="text-xs text-muted-foreground px-3 py-2 bg-muted/50 font-medium">Amostra ({rawRows.length} linhas)</p>
                  <div className="max-h-32 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>{fileColumns.slice(0, 6).map(col => <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>)}</TableRow>
                      </TableHeader>
                      <TableBody>
                        {rawRows.slice(0, 3).map((r, i) => (
                          <TableRow key={i}>
                            {fileColumns.slice(0, 6).map(col => <TableCell key={col} className="text-xs py-1 whitespace-nowrap max-w-[120px] truncate">{String(r[col] ?? '—')}</TableCell>)}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={resetAll} className="rounded-xl">Cancelar</Button>
                  <Button size="sm" onClick={processMapping} disabled={!columnMapping.data || !columnMapping.valor || !columnMapping.categoria} className="rounded-xl">
                    <Eye className="w-4 h-4 mr-1" /> Visualizar Dados
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Preview step */}
            {step === 'preview' && (
              <motion.div key="preview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      {preview.length} lançamentos válidos
                    </p>
                    {invalidCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">{invalidCount} linhas ignoradas (sem data, valor ou categoria)</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setStep('mapping')} className="rounded-xl">
                      <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                    </Button>
                    <Button size="sm" onClick={handleConfirmImport} disabled={insertMutation.isPending || preview.length === 0} className="rounded-xl">
                      {insertMutation.isPending ? 'Importando...' : <><CheckCircle2 className="w-4 h-4 mr-1" /> Importar {preview.length}</>}
                    </Button>
                  </div>
                </div>

                {/* Unmapped categories */}
                {unmapped.length > 0 && (
                  <div className="mb-4 p-4 rounded-xl border border-orange-400/30 bg-orange-50/50 dark:bg-orange-900/10 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2 text-orange-700 dark:text-orange-400">
                      <AlertTriangle className="w-4 h-4" />
                      Categorias não reconhecidas ({unmapped.length})
                    </p>
                    <p className="text-xs text-muted-foreground">Associe a uma categoria existente ou crie uma nova vinculada a uma categoria mãe.</p>
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {unmapped.map(u => {
                        const norm = normalizeStr(u.categoria);
                        const isNew = !!newCatMappings[norm];
                        return (
                          <div key={u.categoria} className="p-2 rounded-lg bg-background border border-border space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs shrink-0 rounded-md">{u.categoria}</Badge>
                              <span className="text-xs text-muted-foreground">→</span>
                              <Select
                                value={categoryMappings[norm] || (isNew ? '__new__' : '')}
                                onValueChange={v => {
                                  if (v === '__new__') {
                                    setCategoryMappings(prev => { const n = { ...prev }; delete n[norm]; return n; });
                                    setNewCatMappings(prev => ({ ...prev, [norm]: { nome: u.categoria, grupo: '' } }));
                                  } else {
                                    setNewCatMappings(prev => { const n = { ...prev }; delete n[norm]; return n; });
                                    setCategoryMappings(prev => ({ ...prev, [norm]: v }));
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs flex-1 rounded-lg"><SelectValue placeholder="Escolher..." /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__new__">+ Criar nova categoria</SelectItem>
                                  {categoriaFilhas.map(c => <SelectItem key={c.id} value={c.nome}>{c.grupo} → {c.nome}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            {isNew && (
                              <div className="flex items-center gap-2 pl-2">
                                <span className="text-xs text-muted-foreground shrink-0">Mãe:</span>
                                <Select
                                  value={newCatMappings[norm]?.grupo || ''}
                                  onValueChange={v => setNewCatMappings(prev => ({ ...prev, [norm]: { ...prev[norm], grupo: v } }))}
                                >
                                  <SelectTrigger className="h-7 text-xs flex-1 rounded-lg"><SelectValue placeholder="Categoria mãe..." /></SelectTrigger>
                                  <SelectContent>
                                    {groupNames.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Data preview */}
                <div className="rounded-xl border border-border overflow-hidden">
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
                            <TableCell className="text-xs py-1.5">{r.categoria}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {preview.length > 15 && (
                    <p className="text-xs text-muted-foreground text-center py-2 bg-muted/30">...e mais {preview.length - 15} lançamentos</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {step === 'idle' && !showManual && (
            <div className="text-xs text-muted-foreground space-y-1 p-4 rounded-xl bg-muted/30">
              <p className="font-medium">Como funciona:</p>
              <p>1. Importe um arquivo CSV ou Excel</p>
              <p>2. Mapeie as colunas: <strong>data</strong>, <strong>valor</strong> e <strong>categoria</strong> (obrigatórios)</p>
              <p>3. Categorias não reconhecidas serão associadas ao plano de contas</p>
              <p className="mt-2 text-muted-foreground/70">O sistema lembra o último mapeamento usado.</p>
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
