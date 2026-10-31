import { useQuery } from '@tanstack/react-query';
import { fetchAllRows } from '@/lib/fetchAll';
import { applyEntityFilterShared, scaleSharedRows } from '@/contexts/GlobalPeriodContext';

/** Busca única e compartilhada dos lançamentos realizados da empresa (ordem por data asc). CNPJ opcional (Quintal). */
export function useRealizedEntries(schoolId: string | undefined | null, entityIdIn?: string | null) {
  const entityId = entityIdIn || 'all';
  return useQuery({
    queryKey: ['realized_entries', schoolId, entityId],
    enabled: !!schoolId,
    queryFn: async ({ signal }) => {
      const rows = await fetchAllRows<any>('realized_entries', q => applyEntityFilterShared(q.eq('school_id', schoolId), entityId).order('data'), 1000, '*', signal);
      return scaleSharedRows(rows, entityId, schoolId!);
    },
  });
}
