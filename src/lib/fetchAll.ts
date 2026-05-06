import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch all rows from a table bypassing the default 1000-row limit by paginating.
 */
export async function fetchAllRows<T = any>(
  table: string,
  builder: (q: any) => any = (q) => q,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const query = builder((supabase as any).from(table).select('*'));
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...((data as T[]) ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
