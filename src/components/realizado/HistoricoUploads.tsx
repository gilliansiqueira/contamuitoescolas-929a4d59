import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, FileSpreadsheet, Eye, EyeOff } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface Props {
  schoolId: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function HistoricoUploads({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const [deleteFile, setDeleteFile] = useState<string | null>(null);
  const [viewFile, setViewFile] = useState<string | null>(null);

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['realized_entries', schoolId] });
      toast.success('Upload e lançamentos vinculados excluídos');
      setDeleteFile(null);
      setViewFile(null);
    },
    onError: () => toast.error('Erro ao excluir'),
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

  if (isLoading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }

  if (uploads.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileSpreadsheet className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum upload encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {uploads.map((u, i) => (
        <motion.div key={u.fileName} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.fileName}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <Badge variant="secondary" className="text-xs">{u.count} lançamentos</Badge>
                      <span className="text-xs text-muted-foreground">{getMonthRange(u.firstDate, u.lastDate)}</span>
                      <span className="text-xs text-muted-foreground">• {formatDate(u.uploadDate)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm font-semibold text-foreground mr-2">{formatCurrency(u.total)}</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewFile(viewFile === u.fileName ? null : u.fileName)} title="Ver lançamentos">
                    {viewFile === u.fileName ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteFile(u.fileName)} title="Excluir upload">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {viewFile === u.fileName && viewEntries.length > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 border-t border-border pt-3">
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
                        {viewEntries.slice(0, 30).map(e => (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs">{e.data}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{e.descricao || '—'}</TableCell>
                            <TableCell className="text-xs text-right font-medium">{formatCurrency(Number(e.valor))}</TableCell>
                            <TableCell className="text-xs">{e.conta_nome || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {viewEntries.length > 30 && (
                      <p className="text-xs text-muted-foreground text-center mt-2">Mostrando 30 de {viewEntries.length}</p>
                    )}
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}

      <AlertDialog open={!!deleteFile} onOpenChange={open => !open && setDeleteFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir upload</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os lançamentos importados do arquivo "{deleteFile}" serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteFile && deleteMutation.mutate(deleteFile)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
