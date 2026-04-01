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
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
        <History className="w-8 h-8 mx-auto mb-3 opacity-50" />
        Nenhuma alteração registrada
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-primary" />
        <h3 className="font-display font-semibold text-foreground">Histórico de Alterações</h3>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {log.map(entry => {
          const Icon = actionIcons[entry.action] || Settings;
          const label = actionLabels[entry.action] || entry.action;
          return (
            <div key={entry.id} className="flex items-start gap-3 bg-muted/30 rounded-lg p-3">
              <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-primary">{label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
