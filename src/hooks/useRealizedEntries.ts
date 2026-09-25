import { useQuery } from '@tanstack/react-query';
import { fetchAllRows } from '@/lib/fetchAll';

/** Busca única e compartilhada dos lançamentos realizados da empresa (ordem por data asc). */
export function useRealizedEntries(schoolId: string | undefined | null) {
  return useQuery({
    queryKey: ['realized_entries', schoolId],
    enabled: !!schoolId,
    queryFn: ({ signal }) =>
      fetchAllRows<any>('realized_entries', q => q.eq('school_id', schoolId).order('data'), 1000, '*', signal),
  });
}
