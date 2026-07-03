/**
 * SSOT para o "Saldo Inicial" exibido no Dashboard e demais telas
 * (Fluxo Diário, etc.).
 *
 * Replica EXATAMENTE a lógica de `saldoInicialCalculado` do Dashboard:
 *  - Se o mês anterior tem snapshot fechado, usa snapshot.saldo_final.
 *  - Senão, parte do saldo base da escola e acumula:
 *      • snapshots de meses anteriores (saldo_movimento)
 *      • lançamentos de meses sem histórico/snapshot
 *      • histórico financeiro consolidado
 *      • operações sempre contam (não são consolidadas em historical_monthly)
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool, useTypeClassifications } from '@/hooks/useFinancialData';
import { useProjectedEntries } from '@/hooks/useProjectedEntries';
import { useSnapshotMap } from '@/hooks/usePeriodSnapshots';
import { useSchoolModel } from '@/hooks/useSchoolModel';
import {
  getEffectiveClassification,
  getSaldoImpact,
} from '@/lib/classificationUtils';
import { resolveTipoMeta } from '@/lib/tipoMeta';

export function useSaldoInicialPeriodo(
  schoolId: string,
  selectedMonths: string[]
): number {
  const { data: school } = useSchool(schoolId);
  const saldoInicialBase = school?.saldoInicial ?? 0;
  const { entries: ssotEntries } = useProjectedEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const snapshotMap = useSnapshotMap(schoolId, 'projecao');
  const { hasModel, isInModel, items: modelItems } = useSchoolModel(schoolId);

  const { data: historicalRowsRaw = [] } = useQuery({
    queryKey: ['historicalMonthly', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historical_monthly' as any)
        .select('month, tipo_valor, valor')
        .eq('school_id', schoolId);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ month: string; tipo_valor: string; valor: number }>;
    },
    enabled: !!schoolId,
  });

  const historicalRows = useMemo(
    () => hasModel ? historicalRowsRaw.filter(r => isInModel(r.tipo_valor)) : historicalRowsRaw,
    [historicalRowsRaw, hasModel, isInModel]
  );

  const activeEntries = useMemo(
    () => ssotEntries.map(e => ({ ...e, data: e.dataProjetada })),
    [ssotEntries]
  );

  return useMemo(() => {
    if (selectedMonths.length === 0) return saldoInicialBase;
    const firstMonth = selectedMonths[0];
    const monthStart = `${firstMonth}-01`;

    const [y, m] = firstMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    if (snapshotMap.has(prevMonth)) {
      return snapshotMap.get(prevMonth)!.saldo_final;
    }

    let saldo = saldoInicialBase;
    const histMonths = new Set(historicalRows.map(r => r.month));
    const snapMonthsBefore = Array.from(snapshotMap.keys()).filter(mo => mo < firstMonth);
    const snapMonthsSet = new Set(snapMonthsBefore);
    for (const sm of snapMonthsBefore) {
      saldo += snapshotMap.get(sm)!.saldo_movimento;
    }
    // Prioridade (mesma do Dashboard.monthSources): snapshot > upload(fluxo) > histórico > projeção.
    // Se um mês anterior tem entries de origem 'fluxo', o upload sobrescreve o histórico consolidado
    // (histórico foi congelado antes do upload e pode conter operações agregadas dentro de
    // Receita/Despesa — usar as duas fontes gera dupla contagem).
    const uploadMonths = new Set<string>();
    for (const e of activeEntries) {
      if (e.data >= monthStart) continue;
      const mo = e.data.slice(0, 7);
      if (e.origem === 'fluxo') uploadMonths.add(mo);
    }
    // Data de "hoje" para separar projeções passadas de futuras (paridade com Dashboard.includeEntry).
    const todayStr = new Date().toISOString().slice(0, 10);
    for (const e of activeEntries) {
      if (e.data >= monthStart) continue;
      const mo = e.data.slice(0, 7);
      if (snapMonthsSet.has(mo)) continue;
      // Mês com upload: sobrescreve projeções passadas (contas_pagar, sponte, cheque, cartão).
      // Só entra fluxo + manual + projeções futuras (data >= hoje). Isto evita dupla contagem
      // de despesas/receitas quando o mês já tem realizado carregado.
      if (uploadMonths.has(mo)) {
        const isFluxo = e.origem === 'fluxo';
        const isManual = e.origem === 'manual';
        const isFutureProj = e.tipoRegistro === 'projetado' && e.origem !== 'fluxo' && e.data >= todayStr;
        if (!(isFluxo || isManual || isFutureProj)) continue;
        saldo += getSaldoImpact(e, classifications);
        continue;
      }
      // Mês só com histórico: histórico dá receita/despesa; entries só contribuem com operações.
      if (histMonths.has(mo)) {
        const cls = getEffectiveClassification(e, classifications);
        if (cls === 'operacao') {
          saldo += getSaldoImpact(e, classifications);
        }
        continue;
      }
      saldo += getSaldoImpact(e, classifications);
    }

    for (const r of historicalRows) {
      if (r.month >= firstMonth) continue;
      if (snapMonthsSet.has(r.month)) continue;
      if (uploadMonths.has(r.month)) continue; // upload manda: ignora histórico deste mês
      const meta = resolveTipoMeta(r.tipo_valor, classifications, modelItems);
      if (!meta.impactaCaixa) continue;
      const v = Number(r.valor) || 0;
      saldo += meta.isEntrada ? v : -v;
    }

    return saldo;
  }, [activeEntries, classifications, saldoInicialBase, selectedMonths, historicalRows, snapshotMap, modelItems]);
}
