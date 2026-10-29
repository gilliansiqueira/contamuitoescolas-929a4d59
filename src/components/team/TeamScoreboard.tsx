import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { PortfolioRow, DailyStatusRow, BacklogRow } from '@/hooks/useManagementPortfolio';
import { buildScoreboard, oldPendencies, managerAlerts, hourSaoPaulo } from '@/lib/teamAlerts';

interface Props { rows: PortfolioRow[]; daily: DailyStatusRow[]; backlog: BacklogRow[]; today: string; reportLate: boolean; nameOf: (userId: string, email: string) => string }

export function TeamScoreboard({ rows, daily, backlog, today, reportLate, nameOf }: Props) {
  const { user, isSuperAdmin } = useAuth() as any;
  const { data: supervised = [] } = useQuery({
    queryKey: ['team_supervision', 'mine', user?.id], enabled: !!user?.id,
    queryFn: async () => { const { data } = await (supabase as any).from('team_supervision').select('member_id').eq('supervisor_id', user.id); return ((data ?? []) as any[]).map(r => r.member_id as string); },
  });
  const board = useMemo(() => {
    const all = buildScoreboard(rows, new Map(daily.map(d => [d.school_id, d])), oldPendencies(backlog, today), reportLate);
    const visible = isSuperAdmin ? all : all.filter(s => s.userId === user?.id || supervised.includes(s.userId));
    return visible.sort((a, b) => b.late - a.late);
  }, [rows, daily, backlog, today, reportLate, isSuperAdmin, supervised, user?.id]);
  if (board.length === 0) return null;
  const hour = hourSaoPaulo();
  return (
    <section className="rounded-lg border border-border bg-card p-3.5">
      <h2 className="mb-2 text-sm font-medium">Placar da equipe</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr className="text-left"><th className="py-1.5 pr-2">Pessoa</th><th className="px-2 text-center">Empresas</th><th className="px-2 text-center">Em dia</th><th className="px-2 text-center">Atrasadas</th><th className="px-2 text-center">Pendências antigas</th><th className="px-2 text-center">Relatórios entregues</th><th className="px-2 text-center">Feito hoje</th><th className="pl-2">Alertas</th></tr></thead>
          <tbody>{board.map(s => {
            const email = rows.find(r => r.responsible_user_id === s.userId)?.responsible_email ?? '';
            const name = nameOf(s.userId, email);
            const warn = managerAlerts(name, s.late, s.lastActivityDay, today, hour);
            return <tr key={s.userId} className="border-t border-border">
              <td className="py-1.5 pr-2 font-medium">{name}</td>
              <td className="px-2 text-center">{s.schools}</td>
              <td className="px-2 text-center text-success">{s.onTime}</td>
              <td className={`px-2 text-center ${s.late ? 'font-semibold text-destructive' : ''}`}>{s.late}</td>
              <td className={`px-2 text-center ${s.oldPend ? 'text-destructive' : ''}`}>{s.oldPend}</td>
              <td className="px-2 text-center">{s.delivered}/{s.schools}</td>
              <td className="px-2 text-center">{s.doneToday}</td>
              <td className="pl-2 text-[11px] text-destructive">{warn.join(' · ')}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  );
}
