/**
 * Hook canônico que devolve o contexto SSOT de movimentação da escola.
 * Consumido por Dashboard, DailyFlowTable e CashFlow — nenhum deles pode
 * calcular movimento/saldo de forma independente.
 */
import { useMemo } from 'react';
import { useHistoricalRows } from '@/hooks/useHistoricalRows';
import { useSchool, useTypeClassifications } from '@/hooks/useFinancialData';
import { useProjectedEntries } from '@/hooks/useProjectedEntries';
import { useSnapshotMap } from '@/hooks/usePeriodSnapshots';
import { useSchoolModel } from '@/hooks/useSchoolModel';
import { useCashflowAnchor } from '@/hooks/useCashflowAnchor';
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
  const cashflowAnchor = useCashflowAnchor(schoolId);
  const { hasModel, isInModel, items: modelItems } = useSchoolModel(schoolId);

  const { data: historicalRowsRaw = [], isLoading: l3 } = useHistoricalRows(schoolId);

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
    cashflowAnchor,
  }), [cashflowAnchor, entries, historicalRows, snapshotMap, classifications, modelItems, saldoInicialBase, saldoInicialBaseDate]);

  return { ctx, isInModel, hasModel, isLoading: l1 || l2 || l3 };
}
