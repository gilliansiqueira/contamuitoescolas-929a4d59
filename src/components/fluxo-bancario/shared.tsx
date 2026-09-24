import { cn } from '@/lib/utils';
import type { ReconStatus } from '@/lib/bankStatements/bankCashflowEngine';

export const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtDate = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');
export const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const STATUS_LABEL: Record<ReconStatus, string> = {
  pendente: 'Pendente',
  conciliado: 'Conciliado',
  nao_se_aplica: 'Não se aplica',
};

export function StatusBadge({ status }: { status: ReconStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        status === 'pendente' && 'bg-warning/15 text-warning',
        status === 'conciliado' && 'bg-success/15 text-success',
        status === 'nao_se_aplica' && 'bg-muted text-muted-foreground',
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
