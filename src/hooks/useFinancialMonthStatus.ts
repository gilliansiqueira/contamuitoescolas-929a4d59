import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FinancialMonthStatus {
  month: string;
  status: string;
  note: string | null;
}

export function useFinancialMonthStatuses(schoolId: string) {
  return useQuery({
    queryKey: ['financial-month-statuses', schoolId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('financial_month_statuses')
        .select('month,status,note')
        .eq('school_id', schoolId);
      if (error) throw error;
      return (data ?? []) as FinancialMonthStatus[];
    },
    enabled: !!schoolId,
  });
}

export function selectedMonthsIncludeReview(selectedMonth: string, statuses: FinancialMonthStatus[]) {
  const reviews = new Set(statuses.filter(item => item.status === 'review').map(item => item.month));
  if (!selectedMonth || selectedMonth === 'all') return reviews.size > 0;
  return selectedMonth.split(',').some(month => reviews.has(month.trim()));
}

export function useFinancialReview(schoolId: string, selectedMonth: string) {
  const query = useFinancialMonthStatuses(schoolId);
  const reviewMonths = useMemo(
    () => (query.data ?? []).filter(item => item.status === 'review').map(item => item.month).sort(),
    [query.data],
  );
  return {
    ...query,
    reviewMonths,
    isInReview: selectedMonthsIncludeReview(selectedMonth, query.data ?? []),
  };
}