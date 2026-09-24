import { supabase } from '@/integrations/supabase/client';

type OrderSpec = { column: string; ascending: boolean; nullsFirst?: boolean };

/**
 * Paginate to bypass the default 1000-row cap using KEYSET pagination on `id`
 * (constant cost per page, unlike OFFSET which gets slower on every page).
 *
 * The builder receives a query with `.select(selectCols)` applied. Apply
 * filters/orders inside the builder. Do NOT add `.range(...)`.
 * Any `.order()` calls made by the builder are captured and applied in memory
 * after all pages are loaded (stable, with `id` as tiebreaker), so callers get
 * exactly the same ordering as before.
 */
export async function fetchAllRows<T = any>(
  table: string,
  builder: (q: any) => any,
  pageSize = 1000,
  selectCols = '*',
): Promise<T[]> {
  const all: any[] = [];
  const orders: OrderSpec[] = [];
  let captured = false;
  // Make sure `id` is available for the cursor.
  const needsId = selectCols.trim() !== '*' && !/(^|,)\s*id\s*(,|$)/.test(selectCols);
  const cols = needsId ? `${selectCols},id` : selectCols;
  let lastId: string | null = null;

  while (true) {
    const base = (supabase as any).from(table).select(cols);
    const wrap = (target: any): any =>
      new Proxy(target, {
        get(t, prop, recv) {
          if (prop === '__raw') return t;
          if (prop === 'order') {
            return (column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => {
              if (!captured) orders.push({ column, ascending: opts?.ascending !== false, nullsFirst: opts?.nullsFirst });
              return wrap(t);
            };
          }
          const v = Reflect.get(t, prop, recv);
          if (typeof v !== 'function' || prop === 'then') return typeof v === 'function' ? v.bind(t) : v;
          return (...args: any[]) => {
            const r = v.apply(t, args);
            return r === t ? wrap(t) : r && typeof r === 'object' && typeof r.order === 'function' ? wrap(r) : r;
          };
        },
      });
    const built = builder(wrap(base));
    captured = true;
    // Unwrap so the cursor ordering is really sent to the server
    // (the proxy swallows .order() calls to re-sort in memory).
    let q: any = built?.__raw ?? built;
    if (lastId !== null) q = q.gt('id', lastId);
    const { data, error } = await (q.order('id', { ascending: true }).limit(pageSize) as any);
    if (error) throw error;
    const rows = (data as any[]) ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    lastId = rows[rows.length - 1].id;
  }

  const specs = orders.filter((o) => o.column !== 'id');
  if (specs.length) {
    const cmp = (a: any, b: any, o: OrderSpec) => {
      const x = a?.[o.column], y = b?.[o.column];
      if (x == null || y == null) {
        if (x == null && y == null) return 0;
        const nullsFirst = o.nullsFirst ?? !o.ascending;
        return (x == null ? -1 : 1) * (nullsFirst ? 1 : -1);
      }
      const r = x < y ? -1 : x > y ? 1 : 0;
      return o.ascending ? r : -r;
    };
    all.sort((a, b) => {
      for (const o of specs) { const r = cmp(a, b, o); if (r) return r; }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }
  if (needsId) for (const r of all as any[]) delete r.id;
  return all as T[];
}
