/** Regras dos avisos da equipe (sem nenhum cálculo financeiro). */
export const OLD_PENDENCY_DAYS = 5;
export const MANAGER_LATE_LIMIT = 3;
export const INACTIVE_HOUR = 14;

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to.slice(0, 10) + 'T00:00:00Z') - Date.parse(from.slice(0, 10) + 'T00:00:00Z')) / 86400000);
}

/** Pendências de conciliação com mais de 5 dias, agrupadas por empresa. */
export function oldPendencies(backlog: { school_id: string; data: string }[], today: string, minDays = OLD_PENDENCY_DAYS) {
  const m = new Map<string, { count: number; oldestDays: number }>();
  for (const b of backlog) {
    const d = daysBetween(b.data, today);
    if (!(d > minDays)) continue;
    const cur = m.get(b.school_id) ?? { count: 0, oldestDays: 0 };
    cur.count += 1; cur.oldestDays = Math.max(cur.oldestDays, d);
    m.set(b.school_id, cur);
  }
  return m;
}

/** Situação do relatório: atrasado, perto do prazo (≤2 dias) ou nada. */
export function reportAlert(dueDate: string | null, today: string, delivered: boolean): { kind: 'late' | 'soon'; days: number } | null {
  if (!dueDate || delivered) return null;
  const d = daysBetween(today, dueDate);
  if (d < 0) return { kind: 'late', days: -d };
  if (d <= 2) return { kind: 'soon', days: d };
  return null;
}

export function isOverdueRequest(r: { prazo: string | null; status: string }, today: string) {
  return !!r.prazo && r.status !== 'resolvido' && r.prazo < today;
}

/** Alerta para gestora: sem atividade até 14h ou 3+ empresas atrasadas. */
export function managerAlerts(person: string, lateSchools: number, lastActivityDay: string | null, today: string, hourSP: number) {
  const out: string[] = [];
  if (hourSP >= INACTIVE_HOUR && lastActivityDay !== today) out.push(`${person} está sem atividade hoje até as ${INACTIVE_HOUR}h`);
  if (lateSchools >= MANAGER_LATE_LIMIT) out.push(`${person} acumula ${lateSchools} empresas atrasadas`);
  return out;
}

export function hourSaoPaulo(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(now)) % 24;
}

export function activityDaySP(ts: string | null) {
  if (!ts) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ts));
}

export interface ScoreInput {
  school_id: string; responsible_user_id: string | null; report_delivered: boolean; last_activity_at: string | null;
}
export interface ScoreRow {
  userId: string; schools: number; onTime: number; late: number; oldPend: number; delivered: number; doneToday: number; lastActivityDay: string | null;
}

/** Placar por responsável de carteira. */
export function buildScoreboard(
  rows: ScoreInput[],
  daily: Map<string, { recon_pending: number; reconciled_today: number; imports_today: number }>,
  old: Map<string, { count: number }>,
  reportLate: boolean,
): ScoreRow[] {
  const m = new Map<string, ScoreRow>();
  for (const r of rows) {
    if (!r.responsible_user_id) continue;
    const s = m.get(r.responsible_user_id) ?? { userId: r.responsible_user_id, schools: 0, onTime: 0, late: 0, oldPend: 0, delivered: 0, doneToday: 0, lastActivityDay: null };
    const d = daily.get(r.school_id);
    const o = old.get(r.school_id)?.count ?? 0;
    const isLate = (d?.recon_pending ?? 0) > 0 || o > 0 || (reportLate && !r.report_delivered);
    s.schools += 1; if (isLate) s.late += 1; else s.onTime += 1;
    s.oldPend += o; if (r.report_delivered) s.delivered += 1;
    s.doneToday += (d?.reconciled_today ?? 0) + (d?.imports_today ?? 0);
    const day = activityDaySP(r.last_activity_at);
    if (day && (!s.lastActivityDay || day > s.lastActivityDay)) s.lastActivityDay = day;
    m.set(r.responsible_user_id, s);
  }
  return [...m.values()];
}

/** Tarefa com horário (ex.: "09:00:00") que já passou e não foi marcada. */
export function isTimedTaskOverdue(t: { due_time: string | null; status: string }, minutesSP: number) {
  if (!t.due_time || t.status !== 'open') return false;
  const [h, m] = t.due_time.split(':').map(Number);
  return minutesSP >= h * 60 + (m || 0);
}

export function minutesSaoPaulo(now = new Date()) {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now).split(':').map(Number);
  return (h % 24) * 60 + m;
}
