import { useState } from 'react';
import { useUploads, useDeleteUpload } from '@/hooks/useFinancialData';
import { UPLOAD_TYPES } from '@/types/financial';
import { motion } from 'framer-motion';
import { Trash2, FileSpreadsheet, History } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface UploadHistoryProps {
  schoolId: string;
  onDataChanged: () => void;
}

export function UploadHistory({ schoolId, onDataChanged }: UploadHistoryProps) {
  const { data: uploads = [], isLoading } = useUploads(schoolId);
  const deleteUpload = useDeleteUpload();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sorted = [...uploads].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteUpload.mutateAsync(deleteId);
      setDeleteId(null);
      onDataChanged();
      toast.success('Upload e transações vinculadas excluídos');
    } catch {
      toast.error('Erro ao excluir upload');
    }
  };

  const getTypeLabel = (key: string) => UPLOAD_TYPES.find(t => t.key === key)?.label || key;

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Histórico de Uploads</h3>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum upload registrado</p>
        ) : (
          <div className="space-y-2">
            {sorted.map(u => (
              <div key={u.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {getTypeLabel(u.tipo)} • {u.recordCount} registros • {new Date(u.uploadedAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteId(u.id)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir upload</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Todas as transações importadas neste upload serão removidas e os cálculos serão refeitos automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUpload.isPending}
            >
              {deleteUpload.isPending ? 'Excluindo...' : 'Excluir Upload'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
