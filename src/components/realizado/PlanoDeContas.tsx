import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit2, Check, X, ChevronRight, ChevronDown, ClipboardPaste, ArrowUp, ArrowDown } from 'lucide-react';
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

function parsePastedText(text: string): { grupo: string; filhas: string[] }[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result: { grupo: string; filhas: string[] }[] = [];
  let current: { grupo: string; filhas: string[] } | null = null;

  for (const raw of lines) {
    const cleaned = raw
      .replace(/\(\*\)/g, '')
      .replace(/^collapse\s*/i, '')
      .trim();
    if (!cleaned) continue;

    const isCategory = /^collapse\s/i.test(raw) || raw === raw.toUpperCase();

    if (isCategory) {
      current = { grupo: cleaned, filhas: [] };
      result.push(current);
    } else {
      if (!current) {
        current = { grupo: 'GERAL', filhas: [] };
        result.push(current);
      }
      if (!current.filhas.includes(cleaned)) {
        current.filhas.push(cleaned);
      }
    }
  }
  return result;
}

export function PlanoDeContas({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['chart_of_accounts', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('school_id', schoolId)
        .order('grupo')
        .order('nome');
      if (error) throw error;
      return data as ContaRow[];
    },
  });

  const bulkInsertMutation = useMutation({
    mutationFn: async (parsed: { grupo: string; filhas: string[] }[]) => {
      const rows = parsed.flatMap(g => {
        const maeRow = {
          school_id: schoolId,
          codigo: '',
          nome: g.grupo,
          tipo: 'despesa',
          grupo: g.grupo,
          nivel: 1,
          pai_id: null,
        };
        const filhaRows = g.filhas.map(f => ({
          school_id: schoolId,
          codigo: '',
          nome: f,
          tipo: 'despesa',
          grupo: g.grupo,
          nivel: 2,
          pai_id: null,
        }));
        return [maeRow, ...filhaRows];
      });
      if (rows.length === 0) return;
      const { error } = await supabase.from('chart_of_accounts').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart_of_accounts', schoolId] });
      toast.success('Plano de contas importado!');
      setPasteText('');
      setShowPaste(false);
    },
    onError: () => toast.error('Erro ao importar plano de contas'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from('chart_of_accounts').update({ nome }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart_of_accounts', schoolId] });
      toast.success('Categoria renomeada');
      setEditId(null);
    },
    onError: () => toast.error('Erro ao renomear'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chart_of_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart_of_accounts', schoolId] });
      toast.success('Categoria removida');
    },
    onError: () => toast.error('Erro ao remover'),
  });

  const promoteToGroupMutation = useMutation({
    mutationFn: async (conta: ContaRow) => {
      const { error } = await supabase
        .from('chart_of_accounts')
        .update({ nivel: 1, grupo: conta.nome })
        .eq('id', conta.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart_of_accounts', schoolId] });
      toast.success('Promovida a categoria mãe');
    },
    onError: () => toast.error('Erro ao promover'),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (grupo: string) => {
      const { error } = await supabase
        .from('chart_of_accounts')
        .delete()
        .eq('school_id', schoolId)
        .eq('grupo', grupo);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart_of_accounts', schoolId] });
      toast.success('Grupo removido');
    },
    onError: () => toast.error('Erro ao remover grupo'),
  });

  const handlePaste = () => {
    const parsed = parsePastedText(pasteText);
    if (parsed.length === 0) {
      toast.error('Nenhuma categoria encontrada no texto colado');
      return;
    }
    bulkInsertMutation.mutate(parsed);
  };

  const grouped = useMemo(() => {
    const groups: Record<string, ContaRow[]> = {};
    contas.forEach(c => {
      const g = c.grupo || 'Sem Grupo';
      if (!groups[g]) groups[g] = [];
      if (c.nivel > 1) groups[g].push(c);
    });
    return groups;
  }, [contas]);

  const toggleGroup = (g: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  };

  const startEdit = (c: ContaRow) => {
    setEditId(c.id);
    setEditValue(c.nome);
  };

  const preview = useMemo(() => parsePastedText(pasteText), [pasteText]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Plano de Contas</CardTitle>
          <Button size="sm" variant={showPaste ? 'secondary' : 'default'} onClick={() => setShowPaste(!showPaste)}>
            <ClipboardPaste className="w-4 h-4 mr-1" /> Colar Plano de Contas
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <AnimatePresence>
            {showPaste && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Cole seu plano de contas abaixo. Linhas em <strong>MAIÚSCULO</strong> ou com <strong>"Collapse"</strong> serão tratadas como categorias mãe. As demais serão subcategorias.
                  </p>
                  <Textarea
                    placeholder={`Exemplo:\nCollapse DESPESAS FIXAS\nAluguel\nÁgua\nLuz\n\nCollapse PESSOAL\nSalários\nINSS`}
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />

                  {preview.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Pré-visualização:</p>
                      <div className="bg-background rounded-md border border-border p-3 space-y-2 max-h-48 overflow-y-auto">
                        {preview.map((g, i) => (
                          <div key={i}>
                            <p className="text-sm font-semibold">{g.grupo}</p>
                            {g.filhas.map((f, j) => (
                              <p key={j} className="text-sm text-muted-foreground pl-4">— {f}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" onClick={handlePaste} disabled={bulkInsertMutation.isPending || !pasteText.trim()}>
                      <Check className="w-4 h-4 mr-1" /> Importar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setPasteText(''); setShowPaste(false); }}>
                      <X className="w-4 h-4 mr-1" /> Cancelar
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isLoading ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Carregando...</p>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-muted-foreground text-sm">Nenhuma categoria cadastrada.</p>
              <p className="text-muted-foreground text-xs">Clique em "Colar Plano de Contas" para começar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(grouped).map(([grupo, items]) => (
                <div key={grupo} className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center bg-muted/50">
                    <button
                      onClick={() => toggleGroup(grupo)}
                      className="flex-1 flex items-center gap-2 px-3 py-2 text-sm font-semibold hover:bg-muted transition-colors"
                    >
                      {expandedGroups.has(grupo) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {grupo}
                      <Badge variant="secondary" className="ml-2">{items.length}</Badge>
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 mr-1 text-destructive"
                      onClick={() => {
                        if (confirm(`Remover o grupo "${grupo}" e todas suas categorias?`)) {
                          deleteGroupMutation.mutate(grupo);
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <AnimatePresence>
                    {expandedGroups.has(grupo) && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="divide-y divide-border">
                          {items.map(c => (
                            <div key={c.id} className="flex items-center gap-2 px-4 py-2 text-sm group">
                              {editId === c.id ? (
                                <>
                                  <Input
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    className="h-7 text-sm flex-1"
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') updateMutation.mutate({ id: c.id, nome: editValue });
                                      if (e.key === 'Escape') setEditId(null);
                                    }}
                                  />
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateMutation.mutate({ id: c.id, nome: editValue })}>
                                    <Check className="w-3 h-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}>
                                    <X className="w-3 h-3" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <span className="flex-1">{c.nome}</span>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(c)} title="Renomear">
                                      <Edit2 className="w-3 h-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => promoteToGroupMutation.mutate(c)} title="Transformar em categoria mãe">
                                      <ArrowUp className="w-3 h-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(c.id)} title="Excluir">
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
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
