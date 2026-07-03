/**
 * Wrapper trivial sobre a SSOT `periodMovement`.
 *
 * Retorna o Saldo Inicial do primeiro mês selecionado, garantindo a
 * invariante `saldoInicial(M) === saldoFinal(M-1)`.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool, useTypeClassifications } from '@/hooks/useFinancialData';
import { useProjectedEntries } from '@/hooks/useProjectedEntries';
import { useSnapshotMap } from '@/hooks/usePeriodSnapshots';
import { useSchoolModel } from '@/hooks/useSchoolModel';
import { computeSaldoInicial, type PeriodMovementCtx, type HistoricalRow } from '@/lib/periodMovement';

export function useSaldoInicialPeriodo(
  schoolId: string,
  selectedMonths: string[]
): number {
  const { data: school } = useSchool(schoolId);
  const saldoInicialBase = school?.saldoInicial ?? 0;
  const saldoInicialBaseDate = school?.saldoInicialData;
  const { entries } = useProjectedEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const snapshotMap = useSnapshotMap(schoolId, 'projecao');
  const { hasModel, isInModel, items: modelItems } = useSchoolModel(schoolId);

  const { data: historicalRowsRaw = [] } = useQuery({
    queryKey: ['historicalMonthly', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historical_monthly' as any)
        .select('month, tipo_valor, valor')
        .eq('school_id', schoolId);
      if (error) throw error;
      return (data ?? []) as unknown as HistoricalRow[];
    },
    enabled: !!schoolId,
  });

  const historicalRows = useMemo(
    () => hasModel ? historicalRowsRaw.filter(r => isInModel(r.tipo_valor)) : historicalRowsRaw,
    [historicalRowsRaw, hasModel, isInModel]
  );

  return useMemo(() => {
    if (selectedMonths.length === 0) return saldoInicialBase;
    const ctx: PeriodMovementCtx = {
      entries,
      historicalRows,
      snapshotMap,
      classifications,
      modelItems,
      saldoInicialBase,
      saldoInicialBaseDate,
    };
    return computeSaldoInicial(selectedMonths[0], ctx, { isInModel });
  }, [
    entries, historicalRows, snapshotMap, classifications, modelItems,
    saldoInicialBase, saldoInicialBaseDate, selectedMonths, isInModel,
  ]);
}
