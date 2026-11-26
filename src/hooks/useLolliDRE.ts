import { useQuery } from '@tanstack/react-query';
import { fetchAllRows } from '@/lib/fetchAll';
import { isLolli, lolliMatchesPeriod } from '@/lib/lolli';
import { buildCommerceDRE } from '@/lib/ledgerEngine';

type Row = Record<string, unknown>;
/** All Lolli financial views use this same query and the shared ledger engine. */
export function useLolliDRE(schoolId: string, months: string[]) {
  return useQuery({
    queryKey: ['lolli-dre', schoolId, months],
    enabled: isLolli(schoolId),
    queryFn: async () => {
      const load = (table: string) => fetchAllRows<Row>(`lolli_${table}`, q => q.eq('school_id', schoolId));
      const [sales, expenses, marketing, manualRevenues, groups, products, costs] = await Promise.all([
        load('sales'), load('expenses'), load('marketing_spend'), load('manual_revenues'),
        load('expense_category_groups'), load('products'), load('product_costs'),
      ]);
      return buildCommerceDRE({
        sales: sales.filter(r => lolliMatchesPeriod(r.data_venda, months)),
        expenses: expenses.filter(r => lolliMatchesPeriod(r.data_despesa, months)),
        marketing: marketing.filter(r => lolliMatchesPeriod(r.data_mkt, months)),
        manualRevenues: manualRevenues.filter(r => lolliMatchesPeriod(r.data, months)),
        groups, products, costs,
      });
    },
  });
}