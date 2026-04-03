import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit2, Check, X, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  schoolId: string;
}

interface ContaRow {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  grupo: string;
  nivel: number;
  pai_id: string | null;
  ativo: boolean;
}

export function PlanoDeContas({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ codigo: '', nome: '', tipo: 'despesa', grupo: '', nivel: 1 });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['chart_of_accounts', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('school_id', schoolId)
        .order('codigo');
      if (error) throw error;
      return data as ContaRow[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (conta: Omit<ContaRow, 'id' | 'ativo'>) => {
      const { error } = await supabase.from('chart_of_accounts').insert({
        school_id: schoolId,
        codigo: conta.codigo,
        nome: conta.nome,
        tipo: conta.tipo,
        grupo: conta.grupo,
        nivel: conta.nivel,
        pai_id: conta.pai_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart_of_accounts', schoolId] });
      toast.success('Conta adicionada');
      resetForm();
    },
    onError: () => toast.error('Erro ao adicionar conta'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<ContaRow> & { id: string }) => {
      const { error } = await supabase.from('chart_of_accounts').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart_of_accounts', schoolId] });
      toast.success('Conta atualizada');
      setEditId(null);
    },
    onError: () => toast.error('Erro ao atualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chart_of_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart_of_accounts', schoolId] });
      toast.success('Conta removida');
    },
    onError: () => toast.error('Erro ao remover'),
  });

  const resetForm = () => {
    setForm({ codigo: '', nome: '', tipo: 'despesa', grupo: '', nivel: 1 });
    setShowForm(false);
  };

  const handleAdd = () => {
    if (!form.codigo.trim() || !form.nome.trim()) {
      toast.error('Código e nome são obrigatórios');
      return;
    }
    addMutation.mutate({ ...form, pai_id: null });
  };

  const grouped = useMemo(() => {
    const groups: Record<string, ContaRow[]> = {};
    contas.forEach(c => {
      const g = c.grupo || 'Sem Grupo';
      if (!groups[g]) groups[g] = [];
      groups[g].push(c);
    });
    return groups;
  }, [contas]);

  const toggleGroup = (g: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Plano de Contas</CardTitle>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-1" /> Nova Conta
          </Button>
        </CardHeader>
        <CardContent>
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 rounded-lg border border-border bg-muted/30">
                  <Input placeholder="Código" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} />
                  <Input placeholder="Nome da conta" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
                  <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Grupo" value={form.grupo} onChange={e => setForm(f => ({ ...f, grupo: e.target.value }))} />
                  <div className="flex gap-1">
                    <Button size="sm" onClick={handleAdd} disabled={addMutation.isPending} className="flex-1">
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={resetForm}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isLoading ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Carregando...</p>
          ) : contas.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma conta cadastrada. Clique em "Nova Conta" para começar.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(grouped).map(([grupo, items]) => (
                <div key={grupo} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleGroup(grupo)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium bg-muted/50 hover:bg-muted transition-colors"
                  >
                    {expandedGroups.has(grupo) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    {grupo}
                    <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
                  </button>
                  <AnimatePresence>
                    {expandedGroups.has(grupo) && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-24">Código</TableHead>
                              <TableHead>Nome</TableHead>
                              <TableHead className="w-24">Tipo</TableHead>
                              <TableHead className="w-20"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map(c => (
                              <TableRow key={c.id}>
                                {editId === c.id ? (
                                  <>
                                    <TableCell>
                                      <Input defaultValue={c.codigo} className="h-8" id={`edit-codigo-${c.id}`} />
                                    </TableCell>
                                    <TableCell>
                                      <Input defaultValue={c.nome} className="h-8" id={`edit-nome-${c.id}`} />
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={c.tipo === 'receita' ? 'default' : 'destructive'}>{c.tipo}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1">
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                                          const codigo = (document.getElementById(`edit-codigo-${c.id}`) as HTMLInputElement)?.value;
                                          const nome = (document.getElementById(`edit-nome-${c.id}`) as HTMLInputElement)?.value;
                                          updateMutation.mutate({ id: c.id, codigo, nome });
                                        }}>
                                          <Check className="w-3 h-3" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}>
                                          <X className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </>
                                ) : (
                                  <>
                                    <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                                    <TableCell>{c.nome}</TableCell>
                                    <TableCell>
                                      <Badge variant={c.tipo === 'receita' ? 'default' : 'destructive'} className="text-xs">
                                        {c.tipo}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1">
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(c.id)}>
                                          <Edit2 className="w-3 h-3" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(c.id)}>
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
