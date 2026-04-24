import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2, Tag, Lock, AlertTriangle, X, Check } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useClosedMonths } from '@/hooks/usePeriodClosures';

interface Props {
  schoolId: string;
}

interface TipoAggregated {
  conta_nome: string;
  count: number;
  total: number;
  hasClosedMonth: boolean;
}

export function TiposHistorico({ schoolId }: Props) {
  const qc = useQueryClient();
  const closedMonths = useClosedMonths(schoolId);
  const [editing, setEditing] = useState<{ original: string; value: string } | null>(null);
  const [deleting, setDeleting] = useState<{ name: string; count: number } | null>(null);
  const [reassignTo, setReassignTo] = useState<string>('');

  const { data: entries = [] } = useQuery({
    queryKey: ['realized_entries', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('realized_entries')
        .select('id, conta_nome, valor, data')
        .eq('school_id', schoolId);
      if (error) throw error;
      return data as { id: string; conta_nome: string; valor: number; data: string }[];
    },
  });

  const tipos = useMemo<TipoAggregated[]>(() => {
    const map = new Map<string, TipoAggregated>();
    entries.forEach(e => {
      const name = e.conta_nome || '(sem categoria)';
      const cur = map.get(name) || { conta_nome: name, count: 0, total: 0, hasClosedMonth: false };
      cur.count++;
      cur.total += Number(e.valor);
      if (e.data && closedMonths.has(e.data.slice(0, 7))) cur.hasClosedMonth = true;
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.conta_nome.localeCompare(b.conta_nome));
  }, [entries, closedMonths]);

  const renameMutation = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const { error } = await supabase
        .from('realized_entries')
        .update({ conta_nome: to })
        .eq('school_id', schoolId)
        .eq('conta_nome', from);
      if (error) throw error;
      // Atualiza também no chart_of_accounts se existir
      await supabase
        .from('chart_of_accounts')
        .update({ nome: to })
        .eq('school_id', schoolId)
        .eq('nome', from);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['realized_entries', schoolId] });
      qc.invalidateQueries({ queryKey: ['chart_of_accounts', schoolId] });
      toast.success('Tipo renomeado e propagado nos lançamentos.');
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao renomear.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      // Reclassifica todas as entradas para o novo tipo
      const { error } = await supabase
        .from('realized_entries')
        .update({ conta_nome: to })
        .eq('school_id', schoolId)
        .eq('conta_nome', from);
      if (error) throw error;
      // Remove do chart_of_accounts
      await supabase
        .from('chart_of_accounts')
        .delete()
        .eq('school_id', schoolId)
        .eq('nome', from);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['realized_entries', schoolId] });
      qc.invalidateQueries({ queryKey: ['chart_of_accounts', schoolId] });
      toast.success('Tipo excluído e lançamentos reclassificados.');
      setDeleting(null);
      setReassignTo('');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao excluir.'),
  });

  const handleConfirmRename = () => {
    if (!editing) return;
    const newName = editing.value.trim();
    if (!newName) { toast.error('Nome não pode ser vazio.'); return; }
    if (newName === editing.original) { setEditing(null); return; }
    if (tipos.some(t => t.conta_nome === newName)) {
      toast.error('Já existe um tipo com esse nome. Use Excluir + Reclassificar.');
      return;
    }
    renameMutation.mutate({ from: editing.original, to: newName });
  };

  const handleConfirmDelete = () => {
    if (!deleting || !reassignTo) {
      toast.error('Selecione o tipo de destino.');
      return;
    }
    deleteMutation.mutate({ from: deleting.name, to: reassignTo });
  };

  const reassignOptions = tipos.filter(t => t.conta_nome !== deleting?.name).map(t => t.conta_nome);

  if (tipos.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Tag className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum tipo encontrado nos lançamentos.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            Tipos / Categorias
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Renomear um tipo atualiza automaticamente todos os lançamentos vinculados. Excluir exige reclassificação.
          </p>
        </div>
        <div className="divide-y">
          {tipos.map((t, i) => {
            const isEditing = editing?.original === t.conta_nome;
            const blocked = t.hasClosedMonth;
            return (
              <motion.div
                key={t.conta_nome}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <Input
                      autoFocus
                      value={editing.value}
                      onChange={e => setEditing({ ...editing, value: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleConfirmRename();
                        if (e.key === 'Escape') setEditing(null);
                      }}
                      className="h-8 rounded-lg"
                    />
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{t.conta_nome}</span>
                      <Badge variant="secondary" className="text-xs">{t.count}</Badge>
                      {blocked && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Lock className="w-3 h-3" /> Mês fechado
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleConfirmRename} disabled={renameMutation.isPending}>
                        <Check className="w-4 h-4 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditing({ original: t.conta_nome, value: t.conta_nome })}
                        disabled={blocked}
                        title={blocked ? 'Há lançamentos em meses fechados' : 'Renomear'}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleting({ name: t.conta_nome, count: t.count })}
                        disabled={blocked}
                        title={blocked ? 'Há lançamentos em meses fechados' : 'Excluir'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!deleting} onOpenChange={o => { if (!o) { setDeleting(null); setReassignTo(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Excluir tipo "{deleting?.name}"
            </AlertDialogTitle>
            <AlertDialogDescription>
              Existem <strong>{deleting?.count} lançamento(s)</strong> vinculado(s).
              Selecione um tipo para reclassificá-los antes da exclusão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Reclassificar para</label>
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Selecione o novo tipo" />
              </SelectTrigger>
              <SelectContent>
                {reassignOptions.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending || !reassignTo}
            >
              Excluir e reclassificar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
