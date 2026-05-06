import { supabase } from '@/integrations/supabase/client';

/**
 * Paginate to bypass Supabase's default 1000-row cap.
 * The builder receives `supabase.from(table)` and must apply `.select(...)` and any filters/orders.
 * Do NOT add `.range(...)` — pagination is handled here.
 */
export async function fetchAllRows<T = any>(
  table: string,
  builder: (q: any) => any,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const query = builder((supabase as any).from(table));
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...((data as T[]) ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
