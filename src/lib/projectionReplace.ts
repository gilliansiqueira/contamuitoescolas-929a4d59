/**
 * Data a partir da qual as projeções antigas da mesma origem são substituídas.
 * - '0000-01-01' = substituir tudo.
 * - Nunca antes de hoje (piso de segurança)...
 * - ...exceto quando o próprio arquivo cobre dias antes disso (ex.: vencimento de
 *   fim de semana antecipado, ou extrato de cartão desde o início do mês). Nesse caso
 *   recua pelos dias que o arquivo cobre de forma contínua (sem buracos de mais de
 *   7 dias), para os dois envios nunca coexistirem no mesmo dia. Datas isoladas muito
 *   antigas (ex.: conta atrasada) não puxam o corte.
 */
export function effectiveReplaceCutoff(cutoffDate: string, today: string, newDates: string[]): string {
  if (cutoffDate === '0000-01-01') return cutoffDate;
  let cut = cutoffDate < today ? today : cutoffDate;
  const before = Array.from(new Set(newDates.filter(Boolean).filter(d => d < cut))).sort().reverse();
  for (const d of before) {
    if (d >= addDays(cut, -7)) cut = d;
    else break;
  }
  return cut;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
