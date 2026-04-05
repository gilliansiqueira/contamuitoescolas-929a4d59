import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Edit2, Check, X, ChevronRight, ChevronDown, ClipboardPaste, ArrowUp, Plus, FolderPlus } from 'lucide-react';
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
    const cleaned = raw.replace(/\(\*\)/g, '').replace(/^collapse\s*/i, '').trim();
    if (!cleaned) continue;
    const isCategory = /^collapse\s/i.test(raw) || raw === raw.toUpperCase();
    if (isCategory) {
      current = { grupo: cleaned, filhas: [] };
      result.push(current);
    } else {
      if (!current) { current = { grupo: 'GERAL', filhas: [] }; result.push(current); }
      if (!current.filhas.includes(cleaned)) current.filhas.push(cleaned);
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
  const [newGroupName, setNewGroupName] = useState('');
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [addSubTo, setAddSubTo] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [moveId, setMoveId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['chart_of_accounts', schoolId] });

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['chart_of_accounts', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('chart_of_accounts').select('*').eq('school_id', schoolId).order('grupo').order('nome');
      if (error) throw error;
      return data as ContaRow[];
    },
  });

  const bulkInsertMutation = useMutation({
    mutationFn: async (parsed: { grupo: string; filhas: string[] }[]) => {
      const rows = parsed.flatMap(g => {
        const maeRow = { school_id: schoolId, codigo: '', nome: g.grupo, tipo: 'despesa', grupo: g.grupo, nivel: 1, pai_id: null };
        const filhaRows = g.filhas.map(f => ({ school_id: schoolId, codigo: '', nome: f, tipo: 'despesa', grupo: g.grupo, nivel: 2, pai_id: null }));
        return [maeRow, ...filhaRows];
      });
      if (rows.length === 0) return;
      const { error } = await supabase.from('chart_of_accounts').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Plano de contas importado!'); setPasteText(''); setShowPaste(false); },
    onError: () => toast.error('Erro ao importar'),
  });

  const addGroupMutation = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from('chart_of_accounts').insert({ school_id: schoolId, codigo: '', nome, tipo: 'despesa', grupo: nome, nivel: 1, pai_id: null });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Categoria mãe adicionada'); setNewGroupName(''); setShowAddGroup(false); },
    onError: () => toast.error('Erro ao adicionar'),
  });

  const addSubMutation = useMutation({
    mutationFn: async ({ nome, grupo }: { nome: string; grupo: string }) => {
      const { error } = await supabase.from('chart_of_accounts').insert({ school_id: schoolId, codigo: '', nome, tipo: 'despesa', grupo, nivel: 2, pai_id: null });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Subcategoria adicionada'); setNewSubName(''); setAddSubTo(null); },
    onError: () => toast.error('Erro ao adicionar'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from('chart_of_accounts').update({ nome }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Renomeada'); setEditId(null); },
    onError: () => toast.error('Erro ao renomear'),
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, grupo }: { id: string; grupo: string }) => {
      const { error } = await supabase.from('chart_of_accounts').update({ grupo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Categoria movida'); setMoveId(null); },
    onError: () => toast.error('Erro ao mover'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chart_of_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Removida'); },
    onError: () => toast.error('Erro ao remover'),
  });

  const promoteToGroupMutation = useMutation({
    mutationFn: async (conta: ContaRow) => {
      const { error } = await supabase.from('chart_of_accounts').update({ nivel: 1, grupo: conta.nome }).eq('id', conta.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Promovida a categoria mãe'); },
    onError: () => toast.error('Erro ao promover'),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (grupo: string) => {
      const { error } = await supabase.from('chart_of_accounts').delete().eq('school_id', schoolId).eq('grupo', grupo);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Grupo removido'); },
    onError: () => toast.error('Erro ao remover grupo'),
  });

  const grouped = useMemo(() => {
    const groups: Record<string, ContaRow[]> = {};
    contas.forEach(c => {
      const g = c.grupo || 'Sem Grupo';
      if (!groups[g]) groups[g] = [];
      if (c.nivel > 1) groups[g].push(c);
    });
    return groups;
  }, [contas]);

  const groupNames = useMemo(() => [...new Set(contas.filter(c => c.nivel === 1).map(c => c.grupo))], [contas]);

  const toggleGroup = (g: string) => {
    setExpandedGroups(prev => { const next = new Set(prev); next.has(g) ? next.delete(g) : next.add(g); return next; });
  };

  const preview = useMemo(() => parsePastedText(pasteText), [pasteText]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Plano de Contas</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowAddGroup(!showAddGroup)}>
              <FolderPlus className="w-4 h-4 mr-1" /> Categoria
            </Button>
            <Button size="sm" variant={showPaste ? 'secondary' : 'default'} onClick={() => setShowPaste(!showPaste)}>
              <ClipboardPaste className="w-4 h-4 mr-1" /> Colar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add group manually */}
          <AnimatePresence>
            {showAddGroup && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="flex gap-2 p-3 rounded-lg border border-border bg-muted/30">
                  <Input placeholder="Nome da categoria mãe" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newGroupName.trim()) addGroupMutation.mutate(newGroupName.trim()); }}
                    autoFocus className="flex-1" />
                  <Button size="sm" onClick={() => newGroupName.trim() && addGroupMutation.mutate(newGroupName.trim())} disabled={addGroupMutation.isPending}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowAddGroup(false); setNewGroupName(''); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Paste section */}
          <AnimatePresence>
            {showPaste && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Cole seu plano de contas. Linhas em <strong>MAIÚSCULO</strong> ou com <strong>"Collapse"</strong> = categorias mãe. Demais = subcategorias.
                  </p>
                  <Textarea placeholder={`Exemplo:\nCollapse DESPESAS FIXAS\nAluguel\nÁgua\nLuz`} value={pasteText} onChange={e => setPasteText(e.target.value)} rows={8} className="font-mono text-sm" />
                  {preview.length > 0 && (
                    <div className="bg-background rounded-md border border-border p-3 space-y-2 max-h-48 overflow-y-auto">
                      {preview.map((g, i) => (
                        <div key={i}>
                          <p className="text-sm font-semibold">{g.grupo}</p>
                          {g.filhas.map((f, j) => <p key={j} className="text-sm text-muted-foreground pl-4">— {f}</p>)}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { const p = parsePastedText(pasteText); if (!p.length) { toast.error('Nenhuma categoria encontrada'); return; } bulkInsertMutation.mutate(p); }} disabled={bulkInsertMutation.isPending || !pasteText.trim()}>
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

          {/* Category tree */}
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Carregando...</p>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-muted-foreground text-sm">Nenhuma categoria cadastrada.</p>
              <p className="text-muted-foreground text-xs">Adicione manualmente ou cole seu plano de contas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(grouped).map(([grupo, items]) => (
                <div key={grupo} className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center bg-muted/50">
                    <button onClick={() => toggleGroup(grupo)} className="flex-1 flex items-center gap-2 px-3 py-2 text-sm font-semibold hover:bg-muted transition-colors">
                      {expandedGroups.has(grupo) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {grupo}
                      <Badge variant="secondary" className="ml-2">{items.length}</Badge>
                    </button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setAddSubTo(addSubTo === grupo ? null : grupo); setNewSubName(''); }} title="Adicionar subcategoria">
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 mr-1 text-destructive" onClick={() => { if (confirm(`Remover "${grupo}" e todas subcategorias?`)) deleteGroupMutation.mutate(grupo); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Add sub inline */}
                  <AnimatePresence>
                    {addSubTo === grupo && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="flex gap-2 px-4 py-2 border-b border-border bg-muted/20">
                          <Input placeholder="Nova subcategoria" value={newSubName} onChange={e => setNewSubName(e.target.value)} className="h-7 text-sm flex-1" autoFocus
                            onKeyDown={e => { if (e.key === 'Enter' && newSubName.trim()) addSubMutation.mutate({ nome: newSubName.trim(), grupo }); if (e.key === 'Escape') setAddSubTo(null); }} />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => newSubName.trim() && addSubMutation.mutate({ nome: newSubName.trim(), grupo })}>
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAddSubTo(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {expandedGroups.has(grupo) && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="divide-y divide-border">
                          {items.map(c => (
                            <div key={c.id} className="flex items-center gap-2 px-4 py-2 text-sm group">
                              {editId === c.id ? (
                                <>
                                  <Input value={editValue} onChange={e => setEditValue(e.target.value)} className="h-7 text-sm flex-1" autoFocus
                                    onKeyDown={e => { if (e.key === 'Enter') updateMutation.mutate({ id: c.id, nome: editValue }); if (e.key === 'Escape') setEditId(null); }} />
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateMutation.mutate({ id: c.id, nome: editValue })}><Check className="w-3 h-3" /></Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}><X className="w-3 h-3" /></Button>
                                </>
                              ) : moveId === c.id ? (
                                <>
                                  <span className="text-xs text-muted-foreground">Mover para:</span>
                                  <Select onValueChange={v => moveMutation.mutate({ id: c.id, grupo: v })}>
                                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Selecionar grupo" /></SelectTrigger>
                                    <SelectContent>
                                      {groupNames.filter(g => g !== c.grupo).map(g => (
                                        <SelectItem key={g} value={g}>{g}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMoveId(null)}><X className="w-3 h-3" /></Button>
                                </>
                              ) : (
                                <>
                                  <span className="flex-1">{c.nome}</span>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditId(c.id); setEditValue(c.nome); }} title="Renomear">
                                      <Edit2 className="w-3 h-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMoveId(c.id)} title="Mover">
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
