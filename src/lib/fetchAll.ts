import { supabase } from '@/integrations/supabase/client';

/**
 * Paginate to bypass Supabase's default 1000-row cap.
 * The builder receives a query that already has `.select(selectCols)` applied.
 * Apply filters/orders inside the builder. Do NOT add `.range(...)`.
 */
export async function fetchAllRows<T = any>(
  table: string,
  builder: (q: any) => any,
  pageSize = 1000,
  selectCols = '*',
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const base = (supabase as any).from(table).select(selectCols);
    const query = builder(base);
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...((data as T[]) ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
