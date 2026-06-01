/**
 * Hook canônico para projeção financeira (SSOT).
 *
 * Todas as telas que mostram valores derivados de financial_entries DEVEM
 * consumir este hook. Não recalcular projeção em componente nenhum.
 */
import { useMemo } from 'react';
import {
  useEntriesFromBaseDate,
  useSchool,
  usePaymentDelayRules,
  useTypeClassifications,
} from '@/hooks/useFinancialData';
import { useSchoolModel } from '@/hooks/useSchoolModel';
import { projectEntries, type ProjectedEntry } from '@/lib/projectionEngine';

export interface UseProjectedEntriesResult {
  entries: ProjectedEntry[];
  isLoading: boolean;
  saldoInicial: number;
  baseDate: string | undefined;
}

export function useProjectedEntries(schoolId: string): UseProjectedEntriesResult {
  const { data: school } = useSchool(schoolId);
  const baseDate = school?.saldoInicialData;
  const { data: rawEntries = [], isLoading: l1 } = useEntriesFromBaseDate(schoolId, baseDate);
  const { data: rules = [], isLoading: l2 } = usePaymentDelayRules(schoolId);
  const { data: classifications = [], isLoading: l3 } = useTypeClassifications(schoolId);
  const model = useSchoolModel(schoolId);

  const entries = useMemo(
    () => projectEntries(rawEntries, rules, classifications, model),
    [rawEntries, rules, classifications, model]
  );

  return {
    entries,
    isLoading: l1 || l2 || l3,
    saldoInicial: school?.saldoInicial ?? 0,
    baseDate,
  };
}
