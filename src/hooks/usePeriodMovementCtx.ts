/**
 * Hook canônico que devolve o contexto SSOT de movimentação da escola.
 * Consumido por Dashboard, DailyFlowTable e CashFlow — nenhum deles pode
 * calcular movimento/saldo de forma independente.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool, useTypeClassifications } from '@/hooks/useFinancialData';
import { useProjectedEntries } from '@/hooks/useProjectedEntries';
import { useSnapshotMap } from '@/hooks/usePeriodSnapshots';
import { useSchoolModel } from '@/hooks/useSchoolModel';
import type { PeriodMovementCtx, HistoricalRow } from '@/lib/periodMovement';

export interface UsePeriodMovementCtx {
  ctx: PeriodMovementCtx;
  isInModel: (label: string) => boolean;
  hasModel: boolean;
  isLoading: boolean;
}

export function usePeriodMovementCtx(schoolId: string): UsePeriodMovementCtx {
  const { data: school } = useSchool(schoolId);
  const saldoInicialBase = school?.saldoInicial ?? 0;
  const saldoInicialBaseDate = school?.saldoInicialData;
  const { entries, isLoading: l1 } = useProjectedEntries(schoolId);
  const { data: classifications = [], isLoading: l2 } = useTypeClassifications(schoolId);
  const snapshotMap = useSnapshotMap(schoolId, 'projecao');
  const { hasModel, isInModel, items: modelItems } = useSchoolModel(schoolId);

  const { data: historicalRowsRaw = [], isLoading: l3 } = useQuery({
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

  const ctx = useMemo<PeriodMovementCtx>(() => ({
    entries,
    historicalRows,
    snapshotMap,
    classifications,
    modelItems,
    saldoInicialBase,
    saldoInicialBaseDate,
  }), [entries, historicalRows, snapshotMap, classifications, modelItems, saldoInicialBase, saldoInicialBaseDate]);

  return { ctx, isInModel, hasModel, isLoading: l1 || l2 || l3 };
}
