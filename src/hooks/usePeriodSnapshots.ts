/**
 * Hook de snapshots de fechamento de período.
 *
 * Quando um mês é fechado, gravamos uma "fotografia" dos totais finais
 * (receitas, despesas, resultado, operações, saldo final) e a quebra por tipo.
 *
 * Após gravado:
 *  - Dashboard prefere o snapshot ao calcular agregados para aquele mês
 *  - Mudanças em type_classifications NÃO afetam meses fechados
 *
 * Ao reabrir: o snapshot é mantido como histórico (auditável), mas a UI
 * volta a mostrar valores recalculados dinamicamente.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ClosureModule } from '@/hooks/usePeriodClosures';

export interface SnapshotPorTipo {
  tipo: string;          // chave canônica
  label: string;         // rótulo amigável
  classificacao: 'receita' | 'despesa' | 'operacao' | 'ignorar';
  sinal: 'somar' | 'subtrair';
  valor: number;
}

export interface PeriodClosureSnapshot {
  id: string;
  school_id: string;
  month: string;        // YYYY-MM
  module: ClosureModule;
  closure_id: string | null;
  receitas: number;
  despesas: number;
  resultado: number;
  operacoes_in: number;
  operacoes_out: number;
  saldo_movimento: number;
  saldo_inicial: number;
  saldo_final: number;
  por_tipo: SnapshotPorTipo[];
  created_at: string;
}

/** Lista snapshots da escola para um módulo. */
export function usePeriodSnapshots(schoolId: string, module: ClosureModule = 'projecao') {
  return useQuery({
    queryKey: ['period_closure_snapshots', schoolId, module],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('period_closure_snapshots' as any)
        .select('*')
        .eq('school_id', schoolId)
        .eq('module', module);
      if (error) throw error;
      return ((data || []) as any[]).map(r => ({
        ...r,
        por_tipo: Array.isArray(r.por_tipo) ? r.por_tipo as SnapshotPorTipo[] : [],
      })) as PeriodClosureSnapshot[];
    },
    enabled: !!schoolId,
  });
}

/** Mapa rápido por mês → snapshot, considerando apenas o snapshot mais recente por mês. */
export function useSnapshotMap(
  schoolId: string,
  module: ClosureModule = 'projecao'
): Map<string, PeriodClosureSnapshot> {
  const { data = [] } = usePeriodSnapshots(schoolId, module);
  const m = new Map<string, PeriodClosureSnapshot>();
  for (const s of data) {
    const existing = m.get(s.month);
    if (!existing || s.created_at > existing.created_at) m.set(s.month, s);
  }
  return m;
}
