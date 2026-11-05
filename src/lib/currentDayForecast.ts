/** SSOT do dia em andamento: realizado + restante previsto, por sentido e papel contábil. */
import { resolveEntryLedgerRule } from '@/lib/ledgerEngine';
import type { ProjectedEntry } from '@/lib/projectionEngine';
import type { TypeClassification } from '@/types/financial';

export function remainingDayForecast(
  projected: ProjectedEntry[], realized: ProjectedEntry[], today: string, classifications: TypeClassification[],
): ProjectedEntry[] {
  const key = (e: ProjectedEntry) => {
    const rule = resolveEntryLedgerRule(e, classifications);
    return `${rule.entraNoResultado ? 'resultado' : 'operacao'}:${rule.operacaoSinal}`;
  };
  const totals = new Map<string, number>();
  const actual = new Map<string, number>();
  for (const e of projected) {
    if (e.dataProjetada !== today || !e.impacto) continue;
    const k = key(e);
    totals.set(k, (totals.get(k) ?? 0) + Math.abs(e.impacto));
  }
  for (const e of realized) {
    if (e.dataProjetada !== today || !e.impacto) continue;
    const k = key(e);
    actual.set(k, (actual.get(k) ?? 0) + Math.abs(e.impacto));
  }
  return projected.map(e => {
    if (e.dataProjetada !== today || !e.impacto) return e;
    const k = key(e);
    const total = totals.get(k) ?? 0;
    const ratio = total > 0 ? Math.max(0, total - (actual.get(k) ?? 0)) / total : 0;
    return { ...e, valor: e.valor * ratio, impacto: e.impacto * ratio };
  });
}