import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Trash2, FileSpreadsheet, Eye, EyeOff, Pencil, Check, X, AlertTriangle, User as UserIcon } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { usePresentation } from '@/components/presentation-provider';

interface Props {
  schoolId: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function HistoricoUploads({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();
  const { isPresentationMode } = usePresentation();
  const canManage = isAdmin && !isPresentationMode;

  const [deleteFile, setDeleteFile] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [viewFile, setViewFile] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ data: string; descricao: string; valor: string; conta_nome: string }>({ data: '', descricao: '', valor: '', conta_nome: '' });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['realized_entries', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('realized_entries').select('*').eq('school_id', schoolId).order('data', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const uploads = useMemo(() => {
    const map: Record<string, { fileName: string; count: number; firstDate: string; lastDate: string; total: number; uploadDate: string }> = {};
    entries.forEach(e => {
      const key = e.origem_arquivo || 'manual';
      if (!map[key]) {
        map[key] = { fileName: key, count: 0, firstDate: e.data, lastDate: e.data, total: 0, uploadDate: e.created_at };
      }
      map[key].count++;
      map[key].total += Number(e.valor);
      if (e.data && e.data < map[key].firstDate) map[key].firstDate = e.data;
      if (e.data && e.data > map[key].lastDate) map[key].lastDate = e.data;
      if (e.created_at < map[key].uploadDate) map[key].uploadDate = e.created_at;
    });
    return Object.values(map).sort((a, b) => b.uploadDate.localeCompare(a.uploadDate));
  }, [entries]);

  const viewEntries = useMemo(() => {
    if (!viewFile) return [];
    return entries.filter(e => (e.origem_arquivo || 'manual') === viewFile);
  }, [entries, viewFile]);

  const deleteMutation = useMutation({
    mutationFn: async (fileName: string) => {
      const { error } = await supabase.from('realized_entries').delete().eq('school_id', schoolId).eq('origem_arquivo', fileName);
      if (error) throw error;
      // Audit log
      try {
        await supabase.from('audit_log').insert({
          school_id: schoolId,
          action: 'delete_upload',
          description: `Importação "${fileName}" excluída por ${user?.email ?? 'usuário'}`,
        });
      } catch { /* ignore */ }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['realized_entries', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['realized_entries'] });
      toast.success('Importação excluída permanentemente');
      setDeleteFile(null);
      setConfirmText('');
      setViewFile(null);
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao excluir'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from('realized_entries').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['realized_entries', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['realized_entries'] });
      toast.success('Lançamento atualizado');
      setEditingRow(null);
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar'),
  });

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
  };

  const getMonthRange = (first: string, last: string) => {
    try {
      const f = first.slice(0, 7);
      const l = last.slice(0, 7);
      return f === l ? f : `${f} → ${l}`;
    } catch { return '—'; }
  };

  const startEdit = (e: any) => {
    setEditingRow(e.id);
    setEditValues({
      data: e.data || '',
      descricao: e.descricao || '',
      valor: String(e.valor ?? 0),
      conta_nome: e.conta_nome || '',
    });
  };

  const saveEdit = (id: string) => {
    const valor = Number(editValues.valor.replace(',', '.'));
    if (Number.isNaN(valor)) { toast.error('Valor inválido'); return; }
    updateMutation.mutate({
      id,
      patch: { data: editValues.data, descricao: editValues.descricao, valor, conta_nome: editValues.conta_nome },
    });
  };

  if (isLoading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }

  if (uploads.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileSpreadsheet className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma importação encontrada.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {uploads.map((u, i) => {
        const isOpen = viewFile === u.fileName;
        return (
        <motion.div key={u.fileName} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.fileName}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <Badge variant="secondary" className="text-xs">{u.count} registros</Badge>
                      <span className="text-xs text-muted-foreground">{getMonthRange(u.firstDate, u.lastDate)}</span>
                      <span className="text-xs text-muted-foreground">• Importado em {formatDate(u.uploadDate)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm font-semibold text-foreground mr-2 hidden sm:inline">{formatCurrency(u.total)}</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setViewFile(isOpen ? null : u.fileName); setEditMode(false); setEditingRow(null); }} title="Abrir">
                    {isOpen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  {canManage && isOpen && (
                    <Button
                      size="icon"
                      variant={editMode ? 'default' : 'ghost'}
                      className="h-8 w-8"
                      onClick={() => { setEditMode(m => !m); setEditingRow(null); }}
                      title="Editar dados"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                  {canManage && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setDeleteFile(u.fileName); setConfirmText(''); }} title="Excluir importação">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {isOpen && viewEntries.length > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 border-t border-border pt-3">
                  <div className="max-h-80 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Data</TableHead>
                          <TableHead className="text-xs">Descrição</TableHead>
                          <TableHead className="text-xs text-right">Valor</TableHead>
                          <TableHead className="text-xs">Categoria</TableHead>
                          {editMode && canManage && <TableHead className="text-xs w-20"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewEntries.slice(0, 100).map(e => {
                          const editing = editingRow === e.id;
                          return (
                            <TableRow key={e.id}>
                              <TableCell className="text-xs">
                                {editing ? <Input value={editValues.data} onChange={ev => setEditValues(v => ({ ...v, data: ev.target.value }))} className="h-7 text-xs" /> : e.data}
                              </TableCell>
                              <TableCell className="text-xs max-w-[240px]">
                                {editing ? <Input value={editValues.descricao} onChange={ev => setEditValues(v => ({ ...v, descricao: ev.target.value }))} className="h-7 text-xs" /> : <span className="block truncate">{e.descricao || '—'}</span>}
                              </TableCell>
                              <TableCell className="text-xs text-right font-medium">
                                {editing ? <Input value={editValues.valor} onChange={ev => setEditValues(v => ({ ...v, valor: ev.target.value }))} className="h-7 text-xs text-right" /> : formatCurrency(Number(e.valor))}
                              </TableCell>
                              <TableCell className="text-xs">
                                {editing ? <Input value={editValues.conta_nome} onChange={ev => setEditValues(v => ({ ...v, conta_nome: ev.target.value }))} className="h-7 text-xs" /> : (e.conta_nome || '—')}
                              </TableCell>
                              {editMode && canManage && (
                                <TableCell className="text-xs">
                                  {editing ? (
                                    <div className="flex gap-1">
                                      <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={() => saveEdit(e.id)} disabled={updateMutation.isPending}><Check className="w-3.5 h-3.5" /></Button>
                                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingRow(null)}><X className="w-3.5 h-3.5" /></Button>
                                    </div>
                                  ) : (
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {viewEntries.length > 100 && (
                      <p className="text-xs text-muted-foreground text-center mt-2">Mostrando 100 de {viewEntries.length}</p>
                    )}
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      );})}

      <AlertDialog open={!!deleteFile} onOpenChange={open => { if (!open) setDeleteFile(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" /> Excluir upload?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Todos os registros do arquivo <strong>"{deleteFile}"</strong> serão removidos e os relatórios recalculados automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFile && deleteMutation.mutate(deleteFile)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir upload'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
