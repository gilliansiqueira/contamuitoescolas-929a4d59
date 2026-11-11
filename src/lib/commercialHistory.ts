/**
 * Histórico comercial multi-ano (contatos receptivos, contatos ativos e matrículas).
 * Anos antigos vêm de `commercial_history_monthly`; anos com dados lançados em
 * `conversion_data` usam sempre a plataforma (nunca o histórico importado).
 */
export type CommercialMetric = 'contatos_receptivos' | 'contatos_ativos' | 'matriculas';
export interface CommercialHistorySeries { metric: CommercialMetric; year: string; months: (number | null)[] }

export function buildCommercialHistory(
  history: { year: number; month: number; metric: string; value: number }[],
  conversion: { month: string; tipo: string; contatos: number; matriculas: number }[],
  throughMonth: string,
): CommercialHistorySeries[] {
  const map = new Map<string, (number | null)[]>();
  const get = (metric: string, year: string) => {
    const k = `${metric}|${year}`;
    if (!map.has(k)) map.set(k, Array(12).fill(null));
    return map.get(k)!;
  };
  const platformYears = new Set(conversion.map(r => r.month.slice(0, 4)));
  history.forEach(h => {
    const y = String(h.year);
    if (platformYears.has(y)) return;
    get(h.metric, y)[h.month - 1] = Number(h.value);
  });
  conversion.forEach(r => {
    if (r.month > throughMonth) return;
    const y = r.month.slice(0, 4); const i = Number(r.month.slice(5, 7)) - 1;
    const tipo = (r.tipo || '').toLowerCase();
    const add = (metric: string, v: number) => { const row = get(metric, y); row[i] = (row[i] ?? 0) + v; };
    if (tipo === 'receptivo') add('contatos_receptivos', Number(r.contatos) || 0);
    if (tipo === 'ativo') add('contatos_ativos', Number(r.contatos) || 0);
    add('matriculas', Number(r.matriculas) || 0);
  });
  return [...map.entries()]
    .map(([k, months]) => { const [metric, year] = k.split('|'); return { metric: metric as CommercialMetric, year, months }; })
    .sort((a, b) => a.metric.localeCompare(b.metric) || a.year.localeCompare(b.year));
}
