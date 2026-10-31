import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEntityFilter } from '@/contexts/GlobalPeriodContext';
import type { HistoricalRow } from '@/lib/periodMovement';

/**
 * Histórico mensal (receita/despesa por mês).
 * - "Todos os CNPJs": usa historical_monthly (consolidado, inalterado).
 * - CNPJ específico: totais mensais calculados no banco (entity_monthly_totals),
 *   com a administração compartilhada rateada pelo percentual do mês.
 */
export function useHistoricalRows(schoolId: string) {
  const entityId = useEntityFilter();
  const byEntity = !!entityId && entityId !== 'all' && entityId !== 'none';
  return useQuery({
    queryKey: ['historicalMonthly', schoolId, entityId],
    enabled: !!schoolId,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<HistoricalRow[]> => {
      const { data: hist, error } = await supabase
        .from('historical_monthly' as any)
        .select('month, tipo_valor, valor')
        .eq('school_id', schoolId);
      if (error) throw error;
      const consolidated = (hist ?? []) as unknown as HistoricalRow[];
      if (!byEntity) return consolidated;

      const histMonths = new Set(consolidated.map(r => r.month));
      const { data, error: e2 } = await (supabase as any).rpc('entity_monthly_totals', { _school_id: schoolId, _entity_id: entityId });
      if (e2) throw e2;
      const map = new Map<string, number>();
      for (const r of (data as any[]) || []) map.set(`${r.month}|${r.tipo_valor}`, Number(r.valor));
      const out: HistoricalRow[] = [];
      for (const m of histMonths) {
        out.push({ month: m, tipo_valor: 'receita', valor: map.get(`${m}|receita`) || 0 } as HistoricalRow);
        out.push({ month: m, tipo_valor: 'despesa', valor: map.get(`${m}|despesa`) || 0 } as HistoricalRow);
      }
      return out;
    },
  });
}
