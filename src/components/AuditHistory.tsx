import { useMemo } from 'react';
import { getAuditLog } from '@/lib/storage';
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
  const log = useMemo(() =>
    getAuditLog(schoolId).sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [schoolId]
  );

  if (log.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
        <History className="w-8 h-8 mx-auto mb-3 opacity-50" />
        Nenhuma alteração registrada.
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center gap-2">
        <History className="w-5 h-5 text-primary" />
        <h3 className="font-display font-semibold text-foreground text-sm">Histórico de Alterações</h3>
        <span className="text-xs text-muted-foreground ml-auto">{log.length} registro(s)</span>
      </div>
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="bg-surface">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Data/Hora</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Ação</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {log.map(entry => {
              const Icon = actionIcons[entry.action] || Settings;
              return (
                <tr key={entry.id} className="border-t border-border/30 hover:bg-surface/50">
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-1.5">
                      <Icon className="w-3 h-3 text-muted-foreground" />
                      {actionLabels[entry.action] || entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{entry.description}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
