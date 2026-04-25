import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { computeMonthSnapshot } from '@/lib/snapshotUtils';
import type { TypeClassification } from '@/types/financial';

export type ClosureModule = 'realizado' | 'projecao';

export interface PeriodClosure {
  id: string;
  school_id: string;
  month: string; // YYYY-MM
  closed_at: string;
  closed_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  reopen_reason: string | null;
  status: 'closed' | 'reopened';
  module: ClosureModule;
}

/** Lista todos os fechamentos (incluindo reabertos) da escola, opcionalmente filtrando por módulo */
export function usePeriodClosures(schoolId: string, module: ClosureModule = 'realizado') {
  return useQuery({
    queryKey: ['period_closures', schoolId, module],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('period_closures')
        .select('*')
        .eq('school_id', schoolId)
        .eq('module', module)
        .order('month', { ascending: false });
      if (error) throw error;
      return (data || []) as PeriodClosure[];
    },
    enabled: !!schoolId,
  });
}

/** Set rápido de meses fechados (status=closed) por módulo */
export function useClosedMonths(schoolId: string, module: ClosureModule = 'realizado'): Set<string> {
  const { data } = usePeriodClosures(schoolId, module);
  return new Set((data || []).filter(c => c.status === 'closed').map(c => c.month));
}

/** Verifica se um mês específico está fechado */
export function useIsMonthClosed(schoolId: string, month: string, module: ClosureModule = 'realizado'): boolean {
  const closed = useClosedMonths(schoolId, module);
  return closed.has(month);
}

/** Verifica se uma data YYYY-MM-DD está em mês fechado */
export function useIsDateClosed(schoolId: string, date: string, module: ClosureModule = 'realizado'): boolean {
  const closed = useClosedMonths(schoolId, module);
  return closed.has(date.slice(0, 7));
}

export function useCloseMonths(schoolId: string, module: ClosureModule = 'realizado') {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (months: string[]) => {
      // 1) Para Projeção, calcula snapshot de cada mês ANTES de fechar
      //    (assim o snapshot reflete os valores correntes naquele momento)
      let classifications: TypeClassification[] = [];
      if (module === 'projecao') {
        const { data: clsRaw = [] } = await supabase
          .from('type_classifications')
          .select('*')
          .eq('school_id', schoolId);
        classifications = (clsRaw as any[]).map(t => ({
          id: t.id,
          school_id: t.school_id,
          tipoValor: t.tipo_valor,
          entraNoResultado: t.entra_no_resultado,
          impactaCaixa: t.impacta_caixa,
          classificacao: t.classificacao,
          operacaoSinal: t.operacao_sinal || 'auto',
          label: t.label,
        }));
      }

      // 2) Cria os fechamentos e captura os IDs criados
      const insertRows = months.map(m => ({
        school_id: schoolId,
        month: m,
        closed_by: user?.id || null,
        status: 'closed' as const,
        module,
      }));
      const { data: created, error } = await supabase
        .from('period_closures')
        .insert(insertRows)
        .select('id, month');
      if (error) throw error;

      // 3) Grava snapshot por mês (apenas Projeção)
      if (module === 'projecao' && created) {
        const snapshotRows: any[] = [];
        for (const c of created as any[]) {
          try {
            const snap = await computeMonthSnapshot(schoolId, c.month, classifications);
            snapshotRows.push({
              school_id: schoolId,
              month: c.month,
              module: 'projecao',
              closure_id: c.id,
              receitas: snap.receitas,
              despesas: snap.despesas,
              resultado: snap.resultado,
              operacoes_in: snap.operacoes_in,
              operacoes_out: snap.operacoes_out,
              saldo_movimento: snap.saldo_movimento,
              saldo_inicial: snap.saldo_inicial,
              saldo_final: snap.saldo_final,
              por_tipo: snap.por_tipo,
              created_by: user?.id || null,
            });
          } catch (e) {
            console.error('Erro ao gerar snapshot de', c.month, e);
          }
        }
        if (snapshotRows.length) {
          const { error: snapErr } = await supabase
            .from('period_closure_snapshots' as any)
            .insert(snapshotRows);
          if (snapErr) console.error('Erro ao gravar snapshots:', snapErr);
        }
      }

      await supabase.from('audit_log').insert({
        school_id: schoolId,
        action: 'config',
        description: `[${module}] Fechou mês(es): ${months.join(', ')}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['period_closures', schoolId, module] });
      qc.invalidateQueries({ queryKey: ['period_closure_snapshots', schoolId, module] });
    },
  });
}

export function useReopenMonth(schoolId: string, module: ClosureModule = 'realizado') {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  return useMutation({
    mutationFn: async ({ closureId, month, reason }: { closureId: string; month: string; reason: string }) => {
      if (!isAdmin) throw new Error('Apenas administradores podem reabrir meses.');
      const { error } = await supabase
        .from('period_closures')
        .update({
          status: 'reopened',
          reopened_at: new Date().toISOString(),
          reopened_by: user?.id || null,
          reopen_reason: reason,
        })
        .eq('id', closureId);
      if (error) throw error;
      await supabase.from('audit_log').insert({
        school_id: schoolId,
        action: 'config',
        description: `[${module}] Reabriu mês ${month}${reason ? ` — motivo: ${reason}` : ''}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['period_closures', schoolId, module] });
    },
  });
}
