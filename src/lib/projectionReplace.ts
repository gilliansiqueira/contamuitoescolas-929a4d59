/**
 * Data a partir da qual as projeções antigas da mesma origem são substituídas.
 * - '0000-01-01' = substituir tudo.
 * - Nunca antes de hoje (piso de segurança)...
 * - ...exceto quando o próprio arquivo grava contas antes disso (ex.: vencimento de
 *   sábado/domingo antecipado para sexta). Nesse caso começa na primeira data gravada,
 *   para os dois envios nunca coexistirem no mesmo dia.
 */
export function effectiveReplaceCutoff(cutoffDate: string, today: string, newDates: string[]): string {
  if (cutoffDate === '0000-01-01') return cutoffDate;
  let cut = cutoffDate < today ? today : cutoffDate;
  const relevant = newDates.filter(Boolean).filter(d => d >= cutoffDate || d >= addDays(cutoffDate < today ? today : cutoffDate, -7));
  const minNew = relevant.sort()[0];
  if (minNew && minNew < cut) cut = minNew;
  return cut;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
