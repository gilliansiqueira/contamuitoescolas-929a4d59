import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductSaleRow {
  id: string;
  school_id: string;
  month: string; // AAAA-MM
  produto: string;
  valor: number;
  quantidade: number;
}

export interface ProductSaleInput {
  produto: string;
  valor: number;
  quantidade: number;
}

export function useProductSales(schoolId: string, monthFrom?: string, monthTo?: string) {
  return useQuery({
    queryKey: ['product_sales', schoolId, monthFrom ?? '', monthTo ?? ''],
    enabled: !!schoolId,
    queryFn: async () => {
      let q = supabase
        .from('product_sales_monthly')
        .select('*')
        .eq('school_id', schoolId)
        .order('month', { ascending: true })
        .order('valor', { ascending: false });
      if (monthFrom) q = q.gte('month', monthFrom);
      if (monthTo) q = q.lte('month', monthTo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProductSaleRow[];
    },
  });
}

/** Meses que já possuem dados (para os seletores). */
export function useProductSalesMonths(schoolId: string) {
  return useQuery({
    queryKey: ['product_sales_months', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_sales_monthly')
        .select('month')
        .eq('school_id', schoolId)
        .order('month', { ascending: true });
      if (error) throw error;
      return [...new Set((data ?? []).map((r: any) => r.month as string))];
    },
  });
}

/** Substitui todos os produtos de um mês (nunca duplica). */
export function useReplaceProductSalesMonth(schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ month, items }: { month: string; items: ProductSaleInput[] }) => {
      const { error: delError } = await supabase
        .from('product_sales_monthly')
        .delete()
        .eq('school_id', schoolId)
        .eq('month', month);
      if (delError) throw delError;
      if (items.length > 0) {
        const rows = items.map(i => ({
          school_id: schoolId,
          month,
          produto: i.produto,
          valor: i.valor,
          quantidade: i.quantidade,
        }));
        const { error: insError } = await supabase.from('product_sales_monthly').insert(rows);
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product_sales', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['product_sales_months', schoolId] });
    },
  });
}
