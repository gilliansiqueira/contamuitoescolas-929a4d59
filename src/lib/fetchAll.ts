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
    // Offset pagination MUST have a deterministic order. Several callers sort
    // only by date; rows sharing the same date can otherwise move between pages
    // and be duplicated/omitted, which changes Dashboard totals on large imports.
    const query = builder(base).order('id', { ascending: true });
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...((data as T[]) ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
