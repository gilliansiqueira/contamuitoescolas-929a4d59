import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Âncora de saldo do Fluxo de Caixa (só quando a fonte está ativa). */
export function useCashflowAnchor(schoolId: string): { month: string; saldo: number } | undefined {
  const { data } = useQuery({
    queryKey: ['bankCashflow', schoolId, 'anchor'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('school_data_sources')
        .select('status, dashboard_source, start_month, opening_balance').eq('school_id', schoolId).maybeSingle();
      if (!data || data.status !== 'ativo' || data.dashboard_source !== 'fluxo_caixa' || data.opening_balance == null) return null;
      return { month: data.start_month as string, saldo: Number(data.opening_balance) };
    },
    enabled: !!schoolId,
  });
  return data ?? undefined;
}
