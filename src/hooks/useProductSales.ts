import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductSaleRow {
  id: string;
  school_id: string;
  month: string; // AAAA-MM
  produto: string;
  valor: number;
  quantidade: number;
  ranking: ProductRanking;
}

export type ProductRanking = 'valor' | 'quantidade';

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
    mutationFn: async ({ month, items, ranking }: { month: string; items: ProductSaleInput[]; ranking: ProductRanking }) => {
      const { error: delError } = await supabase
        .from('product_sales_monthly')
        .delete()
        .eq('school_id', schoolId)
        .eq('month', month)
        .eq('ranking', ranking);
      if (delError) throw delError;
      if (items.length > 0) {
        const rows = items.map(i => ({
          school_id: schoolId,
          month,
          produto: i.produto,
          valor: i.valor,
          quantidade: i.quantidade,
          ranking,
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

/** Apaga as listas escolhidas de um mês e registra no histórico. */
export function useDeleteProductSalesMonth(schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ month, rankings }: { month: string; rankings: ProductRanking[] }) => {
      const { error } = await supabase
        .from('product_sales_monthly')
        .delete()
        .eq('school_id', schoolId)
        .eq('month', month)
        .in('ranking', rankings);
      if (error) throw error;
      const nomes = rankings.map(r => (r === 'valor' ? 'Por valor' : 'Por quantidade')).join(' e ');
      await supabase.from('audit_log').insert({ school_id: schoolId, action: 'product_sales_delete', description: `Produtos mais vendidos apagados: ${month} (${nomes})` } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product_sales', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['product_sales_months', schoolId] });
    },
  });
}
