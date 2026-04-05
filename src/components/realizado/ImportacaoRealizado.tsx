import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Trash2, Plus, Check, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

interface Props {
  schoolId: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ImportacaoRealizado({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ data: '', descricao: '', valor: '', categoria: '' });
  const [preview, setPreview] = useState<any[]>([]);
  const [unmapped, setUnmapped] = useState<{ categoria: string; index: number }[]>([]);
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

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['realized_entries', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('realized_entries').select('*').eq('school_id', schoolId).order('data', { ascending: false });
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
      const { error } = await supabase.from('realized_entries').insert(mapped);
      if (error) throw error;
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('realized_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['realized_entries', schoolId] });
      toast.success('Lançamento removido');
    },
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
            const found = Object.keys(r).find(c => c.toLowerCase().trim() === k);
            if (found) return r[found];
          }
          return undefined;
        };

        const parsed = rows.map(r => {
          const dataRaw = colFind(r, ['data', 'date', 'dt']);
          const data = String(dataRaw || '').trim();
          const descricao = String(colFind(r, ['descricao', 'descrição', 'desc', 'historico', 'histórico']) || '').trim();
          const valorRaw = colFind(r, ['valor', 'value', 'vlr', 'total']);
          const valor = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
          const categoria = String(colFind(r, ['categoria', 'category', 'cat', 'conta', 'account']) || '').trim();

          return { data, descricao, valor: Math.abs(valor), categoria, origem_arquivo: file.name };
        }).filter(r => r.data && r.valor > 0);

        // Check for unmapped categories
        const knownNames = new Set(contas.map(c => c.nome.toLowerCase()));
        const unmappedCats: { categoria: string; index: number }[] = [];
        const seen = new Set<string>();
        parsed.forEach((r, i) => {
          if (r.categoria && !knownNames.has(r.categoria.toLowerCase()) && !seen.has(r.categoria.toLowerCase())) {
            unmappedCats.push({ categoria: r.categoria, index: i });
            seen.add(r.categoria.toLowerCase());
          }
        });

        setPreview(parsed);
        setUnmapped(unmappedCats);
        if (parsed.length === 0) toast.error('Nenhum registro encontrado. Verifique se o arquivo tem colunas: data, valor, categoria');
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
      const mappedCat = categoryMappings[r.categoria.toLowerCase()];
      return { ...r, categoria: mappedCat || r.categoria };
    });
    insertMutation.mutate(final);
  };

  const handleManualAdd = () => {
    if (!manual.data || !manual.valor) {
      toast.error('Data e valor são obrigatórios');
      return;
    }
    const entry = {
      data: manual.data,
      descricao: manual.descricao,
      valor: Math.abs(parseFloat(manual.valor.replace(',', '.')) || 0),
      categoria: manual.categoria,
      origem_arquivo: 'manual',
    };
    insertMutation.mutate([entry]);
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
                  <Input type="date" placeholder="Data" value={manual.data} onChange={e => setManual(m => ({ ...m, data: e.target.value }))} />
                  <Input placeholder="Descrição" value={manual.descricao} onChange={e => setManual(m => ({ ...m, descricao: e.target.value }))} />
                  <Input placeholder="Valor" value={manual.valor} onChange={e => setManual(m => ({ ...m, valor: e.target.value }))} />
                  <Select value={manual.categoria} onValueChange={v => setManual(m => ({ ...m, categoria: v }))}>
                    <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      {categoriaFilhas.map(c => (
                        <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                      ))}
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

          {/* Unmapped categories warning */}
          {unmapped.length > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2 text-yellow-700">
                <AlertTriangle className="w-4 h-4" />
                Categorias não encontradas no plano de contas ({unmapped.length})
              </p>
              <p className="text-xs text-muted-foreground">Associe cada categoria do arquivo a uma categoria do plano de contas, ou deixe em branco para manter o nome original.</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {unmapped.map(u => (
                  <div key={u.categoria} className="flex items-center gap-2">
                    <span className="text-xs font-medium min-w-[120px]">{u.categoria}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <Select value={categoryMappings[u.categoria.toLowerCase()] || ''} onValueChange={v => setCategoryMappings(prev => ({ ...prev, [u.categoria.toLowerCase()]: v }))}>
                      <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Manter original" /></SelectTrigger>
                      <SelectContent>
                        {categoriaFilhas.map(c => (
                          <SelectItem key={c.id} value={c.nome}>{c.grupo} → {c.nome}</SelectItem>
                        ))}
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
                    Confirmar Importação
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
                        <TableCell className="text-xs">{r.descricao}</TableCell>
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
            <p className="font-medium">Colunas aceitas no arquivo:</p>
            <p><strong>Obrigatórias:</strong> data, valor</p>
            <p><strong>Opcionais:</strong> descricao, categoria</p>
            <p className="mt-1">A categoria será associada automaticamente ao plano de contas quando possível.</p>
          </div>
        </CardContent>
      </Card>

      {/* Recent entries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Lançamentos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Carregando...</p>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Nenhum lançamento importado.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.slice(0, 50).map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{e.data}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{e.descricao}</TableCell>
                      <TableCell className="text-xs font-medium">{formatCurrency(e.valor)}</TableCell>
                      <TableCell className="text-xs">{e.conta_nome || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.origem_arquivo}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(e.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {entries.length > 50 && <p className="text-xs text-muted-foreground text-center mt-2">Mostrando 50 de {entries.length}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
