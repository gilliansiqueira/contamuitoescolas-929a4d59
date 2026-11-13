/**
 * Calcula e grava nos Indicadores as lucratividades automáticas (SSOT) para os
 * meses de outubro/2026 até o mês atual. Meses fechados não são regravados
 * (o banco bloqueia alterações em mês fechado).
 */
import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePeriodMovementCtx } from '@/hooks/usePeriodMovementCtx';
import { buildMonthMovement } from '@/lib/periodMovement';
import { computeProfitability, isAutoProfitMonth, AUTO_PROFIT_START, AUTO_PROFIT_EARLY_FEATURE, AUTO_PROFIT_EARLY_START, PROFIT_LABELS, type ProfitKey } from '@/lib/profitability';
import { toast } from 'sonner';
import { useSchoolFeature } from '@/hooks/useBankPilot';

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function useIntegralRevenue(schoolId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['monthly_integral_revenue', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('monthly_integral_revenue').select('month, valor').eq('school_id', schoolId);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach(r => { map[r.month] = Number(r.valor); });
      return map;
    },
    enabled: !!schoolId,
  });
  const save = useMutation({
    mutationFn: async ({ month, valor }: { month: string; valor: number | null }) => {
      if (valor == null || !(valor > 0)) {
        const { error } = await supabase.from('monthly_integral_revenue').delete().eq('school_id', schoolId).eq('month', month);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('monthly_integral_revenue')
          .upsert({ school_id: schoolId, month, valor }, { onConflict: 'school_id,month' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly_integral_revenue', schoolId] });
      toast.success('Receita integral salva');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao salvar'),
  });
  return { values: query.data ?? {}, save };
}

export function useAutoProfitability(schoolId: string) {
  const qc = useQueryClient();
  const { ctx, isInModel, isLoading } = usePeriodMovementCtx(schoolId);
  const { values: integral } = useIntegralRevenue(schoolId);
  const { data: early, isLoading: earlyLoading } = useSchoolFeature(schoolId, AUTO_PROFIT_EARLY_FEATURE, true);
  const start = early ? AUTO_PROFIT_EARLY_START : AUTO_PROFIT_START;

  const { data: defs } = useQuery({
    queryKey: ['kpi_auto_defs', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('kpi_definitions').select('id, auto_key, sort_order').eq('school_id', schoolId).not('auto_key', 'is', null);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!schoolId,
  });

  const computed = useMemo(() => {
    if (isLoading || earlyLoading) return null;
    const cm = currentMonth();
    const out: Record<string, Record<ProfitKey, number | null>> = {};
    let m = start;
    while (isAutoProfitMonth(m, cm, start)) {
      const mv = buildMonthMovement(m, ctx, { isInModel });
      if (mv.source !== 'vazio') out[m] = computeProfitability(mv, integral[m]);
      const [y, mm] = m.split('-').map(Number);
      m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`;
    }
    return out;
  }, [ctx, isInModel, isLoading, earlyLoading, start, integral]);

  const lastSig = useRef('');
  useEffect(() => {
    if (!computed || !defs) return;
    // Só escolas que já usam lucratividade automática (ou preencheram receita integral) recebem gravação.
    if (!defs.length && !Object.values(computed).some(v => v.lucro_integral != null)) return;
    const sig = JSON.stringify([computed, defs.map(d => d.id)]);
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    (async () => {
      let list = defs;
      const needsIntegral = Object.values(computed).some(v => v.lucro_integral != null);
      if (needsIntegral && !list.some(d => d.auto_key === 'lucro_integral')) {
        const maxSort = Math.max(0, ...list.map(d => d.sort_order ?? 0));
        const { data } = await supabase.from('kpi_definitions').insert({
          school_id: schoolId, name: PROFIT_LABELS.lucro_integral, auto_key: 'lucro_integral',
          value_type: 'percent', direction: 'higher_is_better', sort_order: maxSort + 1, enabled: true,
        } as any).select('id, auto_key, sort_order').single();
        if (data) list = [...list, data];
      }
      const { data: closed } = await supabase.from('period_closures').select('month, status').eq('school_id', schoolId);
      const closedSet = new Set((closed ?? []).filter((c: any) => c.status === 'closed').map((c: any) => c.month));
      const rows: { school_id: string; kpi_definition_id: string; month: string; value: number }[] = [];
      const toDelete: { id: string; month: string }[] = [];
      for (const [month, vals] of Object.entries(computed)) {
        if (closedSet.has(month)) continue;
        for (const d of list) {
          const v = vals[d.auto_key as ProfitKey];
          if (v == null) { if (d.auto_key === 'lucro_integral') toDelete.push({ id: d.id, month }); continue; }
          rows.push({ school_id: schoolId, kpi_definition_id: d.id, month, value: v });
        }
      }
      const byMonth = new Map<string, typeof rows>();
      rows.forEach(r => byMonth.set(r.month, [...(byMonth.get(r.month) ?? []), r]));
      for (const monthRows of byMonth.values()) {
        // Um mês por vez: se o banco recusar (mês fechado), os outros seguem.
        await supabase.from('kpi_values').upsert(monthRows, { onConflict: 'school_id,kpi_definition_id,month' });
      }
      for (const t of toDelete) {
        await supabase.from('kpi_values').delete().eq('school_id', schoolId).eq('kpi_definition_id', t.id).eq('month', t.month);
      }
      qc.invalidateQueries({ queryKey: ['kpi_values', schoolId] });
      qc.invalidateQueries({ queryKey: ['kpi_definitions', schoolId] });
    })().catch(() => { /* mês fechado ou sem permissão: mantém valores gravados */ });
  }, [computed, defs, schoolId, qc]);

  return { computed };
}
