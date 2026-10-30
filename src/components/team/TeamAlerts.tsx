import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { School } from '@/types/financial';
import {
  useManagementPortfolio, useManagementDailyStatus, useManagementBacklog, useManagementResponsibleDisplayNames, todaySaoPaulo,
} from '@/hooks/useManagementPortfolio';
import { defaultReportMonth } from '@/lib/reportMonth';
import {
  oldPendencies, reportAlert, isOverdueRequest, managerAlerts, buildScoreboard, hourSaoPaulo, OLD_PENDENCY_DAYS, isTimedTaskOverdue, minutesSaoPaulo,
} from '@/lib/teamAlerts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, AlertTriangle } from 'lucide-react';

type Alert = { key: string; tone: 'late' | 'warn' | 'team'; text: string; schoolId?: string };

export function useTeamAlerts(enabled: boolean) {
  const { user, isSuperAdmin } = useAuth() as any;
  const today = todaySaoPaulo();
  const month = defaultReportMonth(today, false);
  const { data: rows = [] } = useManagementPortfolio(month, enabled);
  const { data: daily = [] } = useManagementDailyStatus(today, enabled);
  const { data: backlog = [] } = useManagementBacklog(today, enabled);
  const { data: names = [] } = useManagementResponsibleDisplayNames(enabled);
  const { data: dueDate = null } = useQuery({
    queryKey: ['report-due-date', month], enabled,
    queryFn: async () => { const { data } = await (supabase as any).rpc('report_due_date', { _month: month }); return (data as string | null) ?? null; },
  });
  const { data: supervised = [] } = useQuery({
    queryKey: ['team_supervision', 'mine', user?.id], enabled: enabled && !!user?.id,
    queryFn: async () => { const { data } = await (supabase as any).from('team_supervision').select('member_id').eq('supervisor_id', user.id); return ((data ?? []) as any[]).map(r => r.member_id as string); },
  });
  const { data: requests = [] } = useQuery({
    queryKey: ['client_requests', 'open'], enabled, refetchInterval: 5 * 60_000,
    queryFn: async () => { const { data } = await (supabase as any).from('client_requests').select('id,school_id,titulo,prazo,status,responsavel_id').neq('status', 'resolvido'); return (data ?? []) as any[]; },
  });

  const mineIds = rows.filter(r => r.responsible_user_id === user?.id).map(r => r.school_id);
  const { data: timed = [] } = useQuery({
    queryKey: ['daily_task_timed', today, mineIds.join(',')], enabled: enabled && mineIds.length > 0, refetchInterval: 5 * 60_000,
    queryFn: async () => {
      await (supabase as any).rpc('ensure_daily_tasks_bulk', { _school_ids: mineIds, _day: today });
      const { data } = await (supabase as any).from('daily_task_checklist').select('id,school_id,label,due_time,status')
        .eq('day', today).in('school_id', mineIds).not('due_time', 'is', null);
      return (data ?? []) as any[];
    },
  });
  const [tick, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick(t => t + 1), 60_000); return () => clearInterval(i); }, []);

  return useMemo(() => {
    const uid = user?.id;
    const alerts: Alert[] = [];
    const dailyBy = new Map(daily.map(d => [d.school_id, d]));
    const old = oldPendencies(backlog, today);
    const mine = rows.filter(r => r.responsible_user_id === uid);
    const fmtM = `${month.slice(5, 7)}/${month.slice(0, 4)}`;
    for (const r of mine) {
      const d = dailyBy.get(r.school_id);
      if (d && d.recon_pending > 0) alerts.push({ key: `rec-${r.school_id}`, tone: 'warn', schoolId: r.school_id, text: `${r.school_name}: ${d.recon_pending} lançamento(s) de ontem sem conciliar` });
      const o = old.get(r.school_id);
      if (o) alerts.push({ key: `old-${r.school_id}`, tone: 'late', schoolId: r.school_id, text: `${r.school_name}: ${o.count} pendência(s) paradas há mais de ${OLD_PENDENCY_DAYS} dias (a mais antiga há ${o.oldestDays} dias)` });
      const rep = reportAlert(dueDate, today, r.report_delivered);
      if (rep) alerts.push({ key: `rep-${r.school_id}`, tone: rep.kind === 'late' ? 'late' : 'warn', schoolId: r.school_id, text: `${r.school_name}: relatório ${fmtM} ${rep.kind === 'late' ? `atrasado ${rep.days} dia(s)` : rep.days === 0 ? 'vence hoje' : `vence em ${rep.days} dia(s)`}` });
    }
    const schoolName = new Map(rows.map(r => [r.school_id, r.school_name]));
    const mins = minutesSaoPaulo();
    for (const t of timed) {
      if (isTimedTaskOverdue(t, mins)) alerts.push({ key: `timed-${t.id}`, tone: 'late', schoolId: t.school_id, text: `${schoolName.get(t.school_id) ?? 'Empresa'}: ${t.label}` });
    }
    for (const q of requests) {
      if (q.responsavel_id === uid && isOverdueRequest(q, today)) alerts.push({ key: `req-${q.id}`, tone: 'late', schoolId: q.school_id, text: `Pedido vencido · ${schoolName.get(q.school_id) ?? 'Empresa'}: ${q.titulo}` });
    }
    // Alertas de gestora
    const watch = new Set<string>(isSuperAdmin ? rows.map(r => r.responsible_user_id).filter((x): x is string => !!x && x !== uid) : supervised);
    if (watch.size) {
      const nameBy = new Map(names.map(n => [n.user_id, n.display_name]));
      const board = buildScoreboard(rows, dailyBy as any, old, (dueDate ?? '9999') < today);
      const hour = hourSaoPaulo();
      for (const s of board) {
        if (!watch.has(s.userId)) continue;
        const email = rows.find(r => r.responsible_user_id === s.userId)?.responsible_email ?? '';
        const label = nameBy.get(s.userId) ?? email.split('@')[0];
        managerAlerts(label, s.late, s.lastActivityDay, today, hour).forEach((t, i) => alerts.push({ key: `team-${s.userId}-${i}`, tone: 'team', text: t }));
      }
    }
    return { alerts, today };
  }, [user?.id, isSuperAdmin, rows, daily, backlog, names, dueDate, supervised, requests, today, month, timed, tick]);
}

interface Props { schools: School[]; onOpenSchool: (s: School) => void; onOpenCenter: () => void }

export function TeamAlerts({ schools, onOpenSchool, onOpenCenter }: Props) {
  const { user, isAdmin } = useAuth() as any;
  const { alerts, today } = useTeamAlerts(!!isAdmin);
  const [popup, setPopup] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user?.id || checked || alerts.length === 0) return;
    setChecked(true);
    (supabase as any).from('team_alert_dismissals').select('dia').eq('user_id', user.id).eq('dia', today).maybeSingle()
      .then(({ data }: any) => { if (!data) setPopup(true); });
  }, [user?.id, today, alerts.length, checked]);

  if (!isAdmin) return null;
  const dismiss = async () => { setPopup(false); await (supabase as any).from('team_alert_dismissals').upsert({ user_id: user.id, dia: today }); };
  const open = (id?: string) => { const s = id && schools.find(x => x.id === id); if (s) { setPopup(false); onOpenSchool(s); } };
  const toneCls = (t: Alert['tone']) => t === 'late' ? 'border-l-destructive bg-destructive/10' : t === 'team' ? 'border-l-info bg-info/10' : 'border-l-warning bg-warning/10';
  const list = (
    <ul className="max-h-[55vh] space-y-1.5 overflow-y-auto">
      {alerts.length === 0 && <li className="text-sm text-muted-foreground">Nenhum atraso. Tudo em dia!</li>}
      {alerts.map(a => (
        <li key={a.key}>
          <button type="button" disabled={!a.schoolId} onClick={() => open(a.schoolId)} className={`w-full rounded-md border-l-4 px-3 py-2 text-left text-xs text-foreground ${toneCls(a.tone)} ${a.schoolId ? 'hover:opacity-80' : 'cursor-default'}`}>{a.text}</button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button size="icon" variant="outline" aria-label="Avisos de atraso" className="fixed bottom-4 right-4 z-50 h-11 w-11 rounded-full bg-card shadow-lg">
            <Bell className="h-5 w-5" />
            {alerts.length > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive px-1.5 text-[11px] font-semibold leading-5 text-destructive-foreground">{alerts.length}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[380px]">
          <p className="mb-2 text-sm font-semibold">Meus avisos</p>
          {list}
          <Button variant="link" size="sm" className="mt-1 px-0" onClick={onOpenCenter}>Ver meu dia completo</Button>
        </PopoverContent>
      </Popover>
      <Dialog open={popup} onOpenChange={o => !o && dismiss()}>
        <DialogContent className="border-4 border-destructive/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl"><AlertTriangle className="h-6 w-6 text-destructive" /> Resumo do seu dia</DialogTitle>
            <DialogDescription>Atrasos e pendências da sua carteira. Clique para abrir a empresa.</DialogDescription>
          </DialogHeader>
          {list}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { dismiss(); onOpenCenter(); }}>Ver meu dia completo</Button>
            <Button onClick={dismiss}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
