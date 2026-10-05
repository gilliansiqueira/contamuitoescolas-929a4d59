/**
 * Totais por mês exatamente como o Fluxo Diário mostra (realizado até o último dia
 * com movimento real + previsto dos dias seguintes). Usa o mesmo cálculo de `buildDailyRows`.
 */
import { useMemo } from 'react';
import { useProjectedEntries } from '@/hooks/useProjectedEntries';
import { usePeriodMovementCtx } from '@/hooks/usePeriodMovementCtx';
import { useEntries, useTypeClassifications } from '@/hooks/useFinancialData';
import { getSaldoImpact } from '@/lib/classificationUtils';
import { resolveMonthSource } from '@/lib/periodMovement';
import { getAllDaysInMonths } from '@/lib/dateUtils';
import { buildDailyRows, closingEstimate } from '@/lib/dailyFlow';
import type { ProjectedEntry } from '@/lib/projectionEngine';

export interface MonthFlowTotals { entrada: number; saida: number; operacoes: number; entradaRealizada: number; entradaRestante: number }

export function useDailyFlowMonthlyTotals(schoolId: string, months: string[]) {
  const { entries: projectedEntries } = useProjectedEntries(schoolId);
  const { data: rawEntries = [] } = useEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const { ctx } = usePeriodMovementCtx(schoolId);

  return useMemo(() => {
    const realized = rawEntries
      .filter(e => e.origem === 'fluxo' && e.tipoRegistro !== 'projetado')
      .map(e => ({ ...e, dataProjetada: e.data, impacto: getSaldoImpact(e, classifications) }) as ProjectedEntry)
      .filter(e => e.impacto !== 0);
    const out: Record<string, MonthFlowTotals> = {};
    for (const m of months) {
      const src = resolveMonthSource(m, ctx);
      const monthSources = { [m]: src };
      const projected = projectedEntries.filter(e => {
        if ((e.origem === 'fluxo' && e.tipoRegistro !== 'projetado') || e.impacto === 0) return false;
        return e.dataProjetada.startsWith(m) && !!src && src !== 'vazio';
      });
      const rows = buildDailyRows({
        allDays: getAllDaysInMonths([m]), priorSaldo: 0, projected, realized: realized.filter(e => e.data.startsWith(m)),
        classifications, historicalRows: ctx.historicalRows as any, monthSources, modelItems: ctx.modelItems,
      });
      out[m] = closingEstimate(rows);
    }
    return out;
  }, [months, projectedEntries, rawEntries, classifications, ctx]);
}
