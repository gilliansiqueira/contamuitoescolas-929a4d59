import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, Plus, Check, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

interface Props {
  schoolId: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizeStr(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function ImportacaoRealizado({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ data: '', descricao: '', valor: '', categoria: '' });
  const [preview, setPreview] = useState<any[]>([]);
  const [unmapped, setUnmapped] = useState<{ categoria: string }[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState('');

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
      setPreview([]);
      setFileName('');
      setUnmapped([]);
      setCategoryMappings({});
    },
    onError: () => toast.error('Erro ao importar lançamentos'),
  });

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

        const colFind = (r: Record<string, any>, keys: string[]) => {
          for (const k of keys) {
            const found = Object.keys(r).find(c => normalizeStr(c) === k);
            if (found) return r[found];
          }
          return undefined;
        };

        const knownNorm = new Set(contas.map(c => normalizeStr(c.nome)));

        const parsed = rows.map(r => {
          const dataRaw = colFind(r, ['data', 'date', 'dt']);
          let data = String(dataRaw || '').trim();
          // Validate date
          if (data && !/^\d{4}-\d{2}-\d{2}/.test(data)) {
            // Try dd/mm/yyyy
            const parts = data.split(/[\/\-\.]/);
            if (parts.length === 3 && parts[2]?.length === 4) {
              data = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else if (parts.length === 3 && parts[0]?.length === 4) {
              data = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
          }
          // Skip invalid dates
          if (!data || !/^\d{4}-\d{2}-\d{2}/.test(data)) return null;

          const descricao = String(colFind(r, ['descricao', 'descrição', 'descricão', 'desc', 'historico', 'historico']) || '').trim();
          const valorRaw = colFind(r, ['valor', 'value', 'vlr', 'total']);
          const valor = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw || '0').replace(/[^\d,.\-]/g, '').replace(',', '.')) || 0;
          if (valor === 0) return null;
          const categoria = String(colFind(r, ['categoria', 'category', 'cat', 'conta', 'account']) || '').trim();

          return { data, descricao, valor: Math.abs(valor), categoria, origem_arquivo: file.name };
        }).filter(Boolean) as any[];

        // Check unmapped
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
        setUnmapped(unmappedCats);
        if (parsed.length === 0) toast.error('Nenhum registro válido encontrado. Verifique se o arquivo tem colunas: data, valor');
        else toast.success(`${parsed.length} lançamentos encontrados`);
      } catch {
        toast.error('Erro ao ler arquivo');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }, [contas]);

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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Importação de Lançamentos</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowManual(!showManual)}>
              <Plus className="w-4 h-4 mr-1" /> Manual
            </Button>
            <label>
              <Button size="sm" asChild>
                <span><Upload className="w-4 h-4 mr-1" /> Importar Arquivo</span>
              </Button>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <AnimatePresence>
            {showManual && (
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

          {/* Preview */}
          {preview.length > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  {fileName}: {preview.length} lançamentos
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setPreview([]); setFileName(''); setUnmapped([]); }}>Cancelar</Button>
                  <Button size="sm" onClick={handleConfirmImport} disabled={insertMutation.isPending}>
                    {insertMutation.isPending ? 'Importando...' : 'Confirmar Importação'}
                  </Button>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Categoria</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 10).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.data}</TableCell>
                        <TableCell className="text-xs">{r.descricao || '—'}</TableCell>
                        <TableCell className="text-xs">{formatCurrency(r.valor)}</TableCell>
                        <TableCell className="text-xs">{r.categoria || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.length > 10 && <p className="text-xs text-muted-foreground text-center mt-1">...e mais {preview.length - 10}</p>}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-1 p-3 rounded-lg bg-muted/30">
            <p className="font-medium">Colunas aceitas:</p>
            <p><strong>Obrigatórias:</strong> data, valor</p>
            <p><strong>Opcionais:</strong> descricao, categoria</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
