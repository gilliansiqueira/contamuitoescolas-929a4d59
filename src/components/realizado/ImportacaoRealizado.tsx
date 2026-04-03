import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Trash2, Plus, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

interface Props {
  schoolId: string;
}

interface RealizedEntry {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: string;
  conta_codigo: string;
  conta_nome: string;
  complemento: string;
  origem_arquivo: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ImportacaoRealizado({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ data: '', descricao: '', valor: '', tipo: 'despesa', conta_codigo: '', conta_nome: '', complemento: '' });
  const [preview, setPreview] = useState<Omit<RealizedEntry, 'id'>[]>([]);
  const [fileName, setFileName] = useState('');

  const { data: contas = [] } = useQuery({
    queryKey: ['chart_of_accounts', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('chart_of_accounts').select('*').eq('school_id', schoolId).order('codigo');
      if (error) throw error;
      return data;
    },
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['realized_entries', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('realized_entries').select('*').eq('school_id', schoolId).order('data', { ascending: false });
      if (error) throw error;
      return data as RealizedEntry[];
    },
  });

  const insertMutation = useMutation({
    mutationFn: async (rows: Omit<RealizedEntry, 'id'>[]) => {
      const { error } = await supabase.from('realized_entries').insert(
        rows.map(r => ({ ...r, school_id: schoolId }))
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['realized_entries', schoolId] });
      toast.success('Lançamentos importados com sucesso');
      setPreview([]);
      setFileName('');
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

        const parsed = rows.map(r => {
          const data = String(r['data'] || r['Data'] || r['DATA'] || '').trim();
          const descricao = String(r['descricao'] || r['Descricao'] || r['DESCRICAO'] || r['Descrição'] || '').trim();
          const valorRaw = r['valor'] || r['Valor'] || r['VALOR'] || 0;
          const valor = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw).replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
          const tipo = String(r['tipo'] || r['Tipo'] || r['TIPO'] || 'despesa').toLowerCase().includes('receita') ? 'receita' : 'despesa';
          const conta_codigo = String(r['conta'] || r['Conta'] || r['CONTA'] || r['conta_codigo'] || '').trim();
          const complemento = String(r['complemento'] || r['Complemento'] || '').trim();

          const conta = contas.find(c => c.codigo === conta_codigo);
          return {
            data,
            descricao,
            valor: Math.abs(valor),
            tipo,
            conta_codigo,
            conta_nome: conta?.nome || '',
            complemento,
            origem_arquivo: file.name,
          };
        }).filter(r => r.data && r.valor > 0);

        setPreview(parsed);
        if (parsed.length === 0) toast.error('Nenhum lançamento válido encontrado no arquivo');
        else toast.success(`${parsed.length} lançamentos encontrados`);
      } catch {
        toast.error('Erro ao ler arquivo');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }, [contas]);

  const handleManualAdd = () => {
    if (!manual.data || !manual.descricao || !manual.valor) {
      toast.error('Data, descrição e valor são obrigatórios');
      return;
    }
    const entry = {
      data: manual.data,
      descricao: manual.descricao,
      valor: Math.abs(parseFloat(manual.valor.replace(',', '.')) || 0),
      tipo: manual.tipo,
      conta_codigo: manual.conta_codigo,
      conta_nome: contas.find(c => c.codigo === manual.conta_codigo)?.nome || '',
      complemento: manual.complemento,
      origem_arquivo: 'manual',
    };
    insertMutation.mutate([entry]);
    setManual({ data: '', descricao: '', valor: '', tipo: 'despesa', conta_codigo: '', conta_nome: '', complemento: '' });
    setShowManual(false);
  };

  return (
    <div className="space-y-4">
      {/* Import Section */}
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
                  <Select value={manual.tipo} onValueChange={v => setManual(m => ({ ...m, tipo: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={manual.conta_codigo} onValueChange={v => setManual(m => ({ ...m, conta_codigo: v }))}>
                    <SelectTrigger><SelectValue placeholder="Conta" /></SelectTrigger>
                    <SelectContent>
                      {contas.map(c => (
                        <SelectItem key={c.id} value={c.codigo}>{c.codigo} - {c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Complemento" value={manual.complemento} onChange={e => setManual(m => ({ ...m, complemento: e.target.value }))} />
                  <div className="flex gap-1 col-span-2 sm:col-span-2">
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

          {/* Preview */}
          {preview.length > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  {fileName}: {preview.length} lançamentos
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setPreview([]); setFileName(''); }}>Cancelar</Button>
                  <Button size="sm" onClick={() => insertMutation.mutate(preview)} disabled={insertMutation.isPending}>
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
                      <TableHead>Tipo</TableHead>
                      <TableHead>Conta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 10).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.data}</TableCell>
                        <TableCell className="text-xs">{r.descricao}</TableCell>
                        <TableCell className="text-xs">{formatCurrency(r.valor)}</TableCell>
                        <TableCell><Badge variant={r.tipo === 'receita' ? 'default' : 'destructive'} className="text-xs">{r.tipo}</Badge></TableCell>
                        <TableCell className="text-xs">{r.conta_codigo}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.length > 10 && <p className="text-xs text-muted-foreground text-center mt-1">...e mais {preview.length - 10}</p>}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="text-xs text-muted-foreground space-y-1 p-3 rounded-lg bg-muted/30">
            <p className="font-medium">Colunas esperadas no arquivo:</p>
            <p>data, descricao, valor, tipo (receita/despesa), conta (código), complemento</p>
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
            <p className="text-muted-foreground text-sm py-8 text-center">Nenhum lançamento realizado importado.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.slice(0, 50).map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{e.data}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{e.descricao}</TableCell>
                      <TableCell className={`text-xs font-medium ${e.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(e.valor)}
                      </TableCell>
                      <TableCell><Badge variant={e.tipo === 'receita' ? 'default' : 'destructive'} className="text-xs">{e.tipo}</Badge></TableCell>
                      <TableCell className="text-xs font-mono">{e.conta_codigo}</TableCell>
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
              {entries.length > 50 && <p className="text-xs text-muted-foreground text-center mt-2">Mostrando 50 de {entries.length} lançamentos</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
