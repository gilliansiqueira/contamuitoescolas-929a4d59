import { useAuditLog } from '@/hooks/useFinancialData';
import { History, Upload, Edit, Trash2, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

interface AuditHistoryProps {
  schoolId: string;
}

const actionIcons: Record<string, typeof Upload> = {
  upload: Upload,
  edit: Edit,
  delete: Trash2,
  delete_upload: Trash2,
  config: Settings,
};

const actionLabels: Record<string, string> = {
  upload: 'Upload',
  edit: 'Edição',
  delete: 'Exclusão',
  delete_upload: 'Exclusão de Upload',
  config: 'Configuração',
};

export function AuditHistory({ schoolId }: AuditHistoryProps) {
  const { data: log = [], isLoading } = useAuditLog(schoolId);

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
        <History className="w-8 h-8 mx-auto mb-3 opacity-50" />
        Carregando...
      </div>
    );
  }

  if (log.length === 0) {
    return
