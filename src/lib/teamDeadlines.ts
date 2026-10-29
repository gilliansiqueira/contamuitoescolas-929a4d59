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
