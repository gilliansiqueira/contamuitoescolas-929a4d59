export interface Deadline { rotulo: string; data: string }

/** Data de hoje em São Paulo (YYYY-MM-DD). */
export function todaySP(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
}

function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
}

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Partes do aviso ainda válidas (prazos vencidos somem). */
export function deadlineParts(deadlines: Deadline[], today: string) {
  return deadlines
    .map(d => ({ ...d, dias: diffDays(today, d.data) }))
    .filter(d => d.dias >= 0)
    .map(d => ({
      ...d,
      texto: d.dias === 0
        ? `é HOJE o prazo para entregar ${d.rotulo} (${fmt(d.data)})`
        : `falta${d.dias > 1 ? 'm' : ''} ${d.dias} dia${d.dias > 1 ? 's' : ''} para entregar ${d.rotulo} (${fmt(d.data)})`,
    }));
}

export const PROJ_STEPS = ['proj_futuras', 'proj_realizado', 'proj_simulacao'] as const;
export const FUTURAS_VALIDADE_DIAS = 15;
export interface ProjStep { school_id: string; step_key: string; status: string; completed_at: string | null }

/** Projeção entregue = 3 etapas concluídas (ou "não se aplica"); "futuras" só vale se marcada até 15 dias antes do prazo. */
export function isProjectionDelivered(steps: ProjStep[], deadline: string): boolean {
  return PROJ_STEPS.every(k => {
    const s = steps.find(x => x.step_key === k);
    if (!s) return false;
    if (s.status === 'not_applicable') return true;
    if (s.status !== 'completed') return false;
    if (k !== 'proj_futuras') return true;
    if (!s.completed_at) return false;
    return diffDays(todaySP(new Date(s.completed_at)), deadline) <= FUTURAS_VALIDADE_DIAS;
  });
}

/** Escolas cuja projeção está atrasada (prazo já passou e não entregue). */
export function overdueProjections(schoolIds: string[], steps: ProjStep[], deadline: string, today: string): string[] {
  if (today <= deadline) return [];
  return schoolIds.filter(id => !isProjectionDelivered(steps.filter(s => s.school_id === id), deadline));
}

/** "faltam X dias para ..." do próximo prazo ainda válido. */
export function nextDeadlineText(deadlines: Deadline[], today: string): string | null {
  return deadlineParts(deadlines, today)[0]?.texto ?? null;
}
