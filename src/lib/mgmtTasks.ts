export type MgmtTaskStatus = 'pendente' | 'andamento' | 'concluida';
export interface MgmtTask {
  id: string; title: string; description: string | null; school_id: string | null;
  assignee_id: string; created_by: string; due_date: string | null; status: MgmtTaskStatus;
  completed_at: string | null; created_at: string;
}
export type MgmtView = 'minhas' | 'todas' | 'concluidas';

/** Atrasada = não concluída e prazo (YYYY-MM-DD) antes de hoje. */
export function isOverdue(t: Pick<MgmtTask, 'status' | 'due_date'>, today: string): boolean {
  return t.status !== 'concluida' && !!t.due_date && t.due_date < today;
}

export function filterTasks(tasks: MgmtTask[], view: MgmtView, me: string, assignee: string, school: string): MgmtTask[] {
  return tasks
    .filter(t => view === 'concluidas' ? t.status === 'concluida' : t.status !== 'concluida')
    .filter(t => view !== 'minhas' || t.assignee_id === me)
    .filter(t => assignee === 'all' || t.assignee_id === assignee)
    .filter(t => school === 'all' || (school === 'none' ? !t.school_id : t.school_id === school))
    .sort((a, b) => (a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : (a.due_date ?? '9999') > (b.due_date ?? '9999') ? 1 : a.created_at.localeCompare(b.created_at));
}

export function memberName(email: string | undefined): string {
  if (!email) return '—';
  const n = email.split('@')[0];
  if (n === 'adm') return 'Bruna';
  if (n === 'anacarolina') return 'Ana';
  if (n === 'isabelly') return 'Isa';
  return n.charAt(0).toUpperCase() + n.slice(1);
}
