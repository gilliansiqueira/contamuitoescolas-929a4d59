/** Aviso das 15:30: empresas sem extrato enviado ou sem conciliação no dia, agrupadas por responsável. */
export const AFTERNOON_CHECK_MINUTES = 15 * 60 + 30;

export interface AfternoonInput {
  rows: { school_id: string; school_name: string; responsible_user_id: string | null; responsible_email: string | null }[];
  daily: { school_id: string; imports_today: number; reconciled_today: number }[];
  /** Empresas com Fluxo Bancário configurado → mês de início (yyyy-mm). */
  bankStart: Map<string, string | null>;
  today: string;
  names: Map<string, string>;
}
export interface AfternoonPerson { key: string; label: string; schools: { schoolId: string; schoolName: string; noStatement: boolean; noRecon: boolean }[] }

export function afternoonBankCheck({ rows, daily, bankStart, today, names }: AfternoonInput): AfternoonPerson[] {
  const byId = new Map(daily.map(d => [d.school_id, d]));
  const month = today.slice(0, 7);
  const people = new Map<string, AfternoonPerson>();
  for (const r of rows) {
    if (!bankStart.has(r.school_id)) continue;
    const start = bankStart.get(r.school_id);
    if (start && start > month) continue;
    const d = byId.get(r.school_id);
    const noStatement = !d || d.imports_today === 0;
    const noRecon = !d || d.reconciled_today === 0;
    if (!noStatement && !noRecon) continue;
    const key = r.responsible_user_id ?? '__none';
    const label = r.responsible_user_id ? (names.get(r.responsible_user_id) ?? (r.responsible_email ?? '').split('@')[0]) : 'Sem responsável';
    const p = people.get(key) ?? { key, label, schools: [] };
    p.schools.push({ schoolId: r.school_id, schoolName: r.school_name, noStatement, noRecon });
    people.set(key, p);
  }
  const list = [...people.values()];
  list.forEach(p => p.schools.sort((a, b) => a.schoolName.localeCompare(b.schoolName, 'pt-BR')));
  return list.sort((a, b) => (a.key === '__none' ? 1 : b.key === '__none' ? -1 : a.label.localeCompare(b.label, 'pt-BR')));
}
