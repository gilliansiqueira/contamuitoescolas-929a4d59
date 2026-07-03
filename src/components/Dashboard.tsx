import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinancialEntry, TypeClassification } from '@/types/financial';
import { useSchool, useTypeClassifications, usePaymentDelayRules } from '@/hooks/useFinancialData';
import { useProjectedEntries } from '@/hooks/useProjectedEntries';
import { useSnapshotMap } from '@/hooks/usePeriodSnapshots';
import { useSchoolModel } from '@/hooks/useSchoolModel';
import { usePeriodMovementCtx } from '@/hooks/usePeriodMovementCtx';
import {
  buildMonthMovement,
  computeSaldoInicial,
  computeSaldoFinal,
  includeEntryForMonth,
  resolveMonthSource,
  type MovementSource,
  type PorTipoAgg,
} from '@/lib/periodMovement';
import { Target, CalendarCheck, ArrowDown, ArrowUp, Wallet, AlertTriangle, Eye, EyeOff, Coins, Layers, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { matchesMonthFilter } from '@/components/MonthSelector';
import { addDaysAndAdjust } from '@/lib/dateUtils';
import { calculateTotals, getSaldoImpact, getEffectiveClassification, getCanonicalKey, normalizeTipo } from '@/lib/classificationUtils';
import { resolveTipoMeta } from '@/lib/tipoMeta';
import { resolveEntryTipoKey } from '@/lib/ledgerEngine';
import { applyPaymentDelay } from '@/lib/projectionEngine';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, BarChart, Bar, Legend, LineChart, Line } from 'recharts';
import { Receivables } from '@/components/Receivables';
import { Button } from '@/components/ui/button';
import { usePresentation } from '@/components/presentation-provider';
import { InsightsBar, type Insight } from '@/components/InsightsBar';
import { InvestimentoSection } from '@/components/InvestimentoSection';
import { TrendingUp, TrendingDown, Sparkles, PiggyBank, Flame } from 'lucide-react';

interface DashboardProps {
  schoolId: string;
  selectedMonth: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Aplica prazo de cobrança usando a função canônica do projectionEngine (SSOT).
// Apenas entries projetadas de origem 'sponte' têm a data deslocada — cartões
// da maquininha (origem 'cartao') sempre usam o vencimento original.
function applyDelays(entries: FinancialEntry[], rules: { formaCobranca: string; prazo: number }[]): FinancialEntry[] {
  return entries.map(e => {
    const data = applyPaymentDelay(e, rules as any);
    return data === e.data ? e : { ...e, data };
  });
}

// resolveTipoMeta agora vem de @/lib/tipoMeta (SSOT).

export function Dashboard({ schoolId, selectedMonth }: DashboardProps) {
  const { isPresentationMode } = usePresentation();
  const { data: school } = useSchool(schoolId);
  const saldoInicial = school?.saldoInicial ?? 0;
  const { entries: ssotEntries } = useProjectedEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const { data: delayRules = [] } = usePaymentDelayRules(schoolId);
  const snapshotMap = useSnapshotMap(schoolId, 'projecao');
  const { hasModel, isInModel, items: modelItems } = useSchoolModel(schoolId);
  const { ctx: movementCtx } = usePeriodMovementCtx(schoolId);
  const [showInsights, setShowInsights] = useState(true);

  const activeEntries = useMemo(
    () => ssotEntries.map(e => ({ ...e, data: e.dataProjetada })),
    [ssotEntries]
  );

  // Histórico Financeiro consolidado (para gráficos que ainda precisam iterar bruto).
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

  const selectedMonths = useMemo<string[]>(() => {
    if (selectedMonth === 'all') {
      const fromEntries = activeEntries.map(e => e.data.slice(0, 7));
      const fromHist = historicalRows.map(r => r.month);
      return Array.from(new Set([...fromEntries, ...fromHist])).sort();
    }
    return selectedMonth.split(',').map(m => m.trim()).filter(Boolean).sort();
  }, [selectedMonth, activeEntries, historicalRows]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // ─── SSOT: fonte oficial por mês (snapshot | fluxo | historico | projecao | vazio) ───
  const monthSources = useMemo(() => {
    const result: Record<string, MovementSource> = {};
    for (const m of selectedMonths) {
      result[m] = resolveMonthSource(m, movementCtx);
    }
    return result;
  }, [selectedMonths, movementCtx]);

  // Helper legado exposto para caminhos auxiliares (gráficos, categorias top).
  const includeEntry = useCallback((e: FinancialEntry, src: MovementSource) => {
    // Aceita ProjectedEntry e FinancialEntry; garante dataProjetada.
    const pe = { ...e, dataProjetada: (e as any).dataProjetada ?? e.data, impacto: (e as any).impacto ?? 0 } as any;
    return includeEntryForMonth(pe, src, todayStr, classifications);
  }, [todayStr, classifications]);

  // ─── SSOT: movimentação canônica por mês selecionado ───
  const monthMovements = useMemo(
    () => selectedMonths.map(m => buildMonthMovement(m, movementCtx, { isInModel })),
    [selectedMonths, movementCtx, isInModel]
  );

  // ─── KPIs DINÂMICOS por tipo — vem de porTipo agregado ───
  type TipoAgg = { key: string; label: string; valor: number; isEntrada: boolean; entraNoResultado: boolean; impactaCaixa: boolean; classificacao: string };
  const tipoAggregations = useMemo<TipoAgg[]>(() => {
    // Mescla porTipo de todos os meses, unificando por rótulo/classificação.
    const stemLabel = (s: string) => s
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\b(real|realizada|realizado|reais|projetada|projetado|prevista|previsto)\b/g, '')
      .replace(/s\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const merged: Record<string, TipoAgg> = {};
    for (const mv of monthMovements) {
      for (const t of mv.porTipo) {
        const mk = `${t.classificacao}|${t.entraNoResultado ? 1 : 0}|${t.impactaCaixa ? 1 : 0}|${t.isEntrada ? 1 : 0}|${stemLabel(t.label)}`;
        if (!merged[mk]) {
          merged[mk] = {
            key: t.key,
            label: t.label,
            valor: t.valor,
            isEntrada: t.isEntrada,
            entraNoResultado: t.entraNoResultado,
            impactaCaixa: t.impactaCaixa,
            classificacao: t.classificacao,
          };
        } else {
          merged[mk].valor += t.valor;
          if (t.label.length < merged[mk].label.length) merged[mk].label = t.label;
        }
      }
    }
    return Object.values(merged)
      .filter(a => a.valor > 0 && a.classificacao !== 'ignorar')
      .sort((a, b) => {
        const order = { receita: 0, despesa: 1, operacao: 2, ignorar: 3 } as Record<string, number>;
        return (order[a.classificacao] ?? 9) - (order[b.classificacao] ?? 9) || b.valor - a.valor;
      });
  }, [monthMovements]);

  // ─── Totais agregados — derivados diretamente dos movimentos (SSOT) ───
  const totals = useMemo(() => {
    let receitas = 0, despesas = 0, operacoesIn = 0, operacoesOut = 0;
    for (const mv of monthMovements) {
      receitas += mv.receitas;
      despesas += mv.despesas;
      operacoesIn += mv.operacoesIn;
      operacoesOut += mv.operacoesOut;
    }
    return { receitas, despesas, resultado: receitas - despesas, operacoesIn, operacoesOut };
  }, [monthMovements]);

  // ─── Saldo Inicial: saldo final do mês anterior ao primeiro selecionado (SSOT) ───
  const saldoInicialCalculado = useMemo(() => {
    if (selectedMonth === 'all' || selectedMonths.length === 0) return saldoInicial;
    return computeSaldoInicial(selectedMonths[0], movementCtx, { isInModel });
  }, [selectedMonth, selectedMonths, saldoInicial, movementCtx, isInModel]);

  // ─── Saldo Final: saldo final do último mês selecionado (SSOT) ───
  // Invariante garantida: saldoInicial(M) === saldoFinal(M-1).
  const saldoFinal = useMemo(() => {
    if (selectedMonth === 'all' || selectedMonths.length === 0) {
      // Modo 'all' — acumula movimentos sobre o saldo base.
      let saldo = saldoInicialCalculado;
      for (const mv of monthMovements) saldo += mv.saldoMovimento;
      return saldo;
    }
    return computeSaldoFinal(selectedMonths[selectedMonths.length - 1], movementCtx, { isInModel });
  }, [selectedMonth, selectedMonths, saldoInicialCalculado, monthMovements, movementCtx, isInModel]);

  // ─── Bandeiras para condicionar UI ───
  const sourcesUsed = useMemo(() => {
    const set = new Set(Object.values(monthSources));
    const hasUpload = set.has('fluxo');
    const hasProjecao = set.has('projecao');
    return {
      hasUpload,
      hasHistorico: set.has('historico'),
      hasProjecao,
      onlyHistorico: set.has('historico') && !hasUpload && !hasProjecao,
    };
  }, [monthSources]);

  const hasRealizado = sourcesUsed.hasUpload || sourcesUsed.hasHistorico;

  // ─── Realizado vs Projetado ───
  // Realizado: fluxo + manuais realizados.
  // Projetado: tudo com tipoRegistro='projetado' (sponte/cheque/cartao/contas_pagar/manual futuro).
  const entriesForRealVsProj = useMemo(() => {
    return activeEntries.filter(e => {
      const m = e.data.slice(0, 7);
      const src = monthSources[m];
      if (!src || src === 'historico' || src === 'snapshot' || src === 'vazio') return false;
      return includeEntry(e, src);
    });
  }, [activeEntries, monthSources, includeEntry]);

  const realizadoTotals = useMemo(() =>
    calculateTotals(entriesForRealVsProj.filter(e => e.tipoRegistro === 'realizado'), classifications),
    [entriesForRealVsProj, classifications]
  );
  const projetadoTotals = useMemo(() =>
    calculateTotals(entriesForRealVsProj.filter(e => e.tipoRegistro === 'projetado'), classifications),
    [entriesForRealVsProj, classifications]
  );

  // ─── Projeção de saldo diário (somente se NÃO for só-histórico) ───
  const projectionData = useMemo(() => {
    if (sourcesUsed.onlyHistorico) return [];
    const today = new Date().toISOString().slice(0, 10);
    const futureEntries = activeEntries.filter(e => {
      if (e.data < today) return false;
      const m = e.data.slice(0, 7);
      const src = monthSources[m];
      // Não desenha dias para meses cujo source é histórico
      return src !== 'historico';
    });
    if (futureEntries.length === 0) return [];

    let saldoToday = saldoInicialCalculado;
    for (const a of tipoAggregations) {
      // Aplica apenas o que já passou (estimativa simples: saldoToday = saldoInicial + tudo já agregado até hoje)
      // Para precisão diária, recomputamos abaixo
    }
    // Recomputa saldoToday percorrendo entries pré-hoje das fontes válidas
    saldoToday = saldoInicialCalculado;
    const histMonthsSet = new Set(historicalRows.map(r => r.month));
    for (const e of activeEntries.filter(x => x.data < today)) {
      const m = e.data.slice(0, 7);
      const src = monthSources[m];
      if (src === 'historico' || src === 'snapshot' || src === 'vazio' || !src) continue;
      if (!includeEntry(e, src)) continue;
      // Mês atual fora do filtro: pula
      if (!selectedMonths.includes(m) && selectedMonth !== 'all') continue;
      saldoToday += getSaldoImpact(e, classifications);
    }

    // SSOT: agrega projeção por IMPACTO no saldo (Ignorar, Transferência entre Contas
    // e sinal configurado pelo usuário são respeitados via getSaldoImpact).
    const byDate: Record<string, { entradas: number; saidas: number }> = {};
    for (const e of futureEntries) {
      const impact = getSaldoImpact(e, classifications);
      if (impact === 0) continue;
      if (!byDate[e.data]) byDate[e.data] = { entradas: 0, saidas: 0 };
      if (impact >= 0) byDate[e.data].entradas += impact;
      else byDate[e.data].saidas += Math.abs(impact);
    }

    const sorted = Object.keys(byDate).sort();
    let saldo = saldoToday;
    return sorted.map(data => {
      const d = byDate[data];
      saldo += d.entradas - d.saidas;
      return { data: data.slice(5).split('-').reverse().join('/'), fullDate: data, entradas: d.entradas, saidas: d.saidas, saldo };
    });
  }, [activeEntries, classifications, saldoInicialCalculado, monthSources, sourcesUsed.onlyHistorico, historicalRows, selectedMonths, selectedMonth, tipoAggregations]);

  // ─── Gráfico de barras mensal: Receitas vs Despesas (combina upload + histórico + snapshot) ───
  const monthlyChart = useMemo(() => {
    const map: Record<string, { entradas: number; saidas: number }> = {};
    for (const m of selectedMonths) {
      const src = monthSources[m];
      if (!map[m]) map[m] = { entradas: 0, saidas: 0 };
      if (src === 'snapshot') {
        const snap = snapshotMap.get(m)!;
        map[m].entradas = snap.receitas;
        map[m].saidas = snap.despesas;
      } else if (src === 'historico') {
        for (const r of historicalRows.filter(x => x.month === m)) {
          const meta = resolveTipoMeta(r.tipo_valor, classifications, modelItems);

          if (!meta.entraNoResultado) continue;
          const v = Number(r.valor) || 0;
          if (meta.classificacao === 'receita') map[m].entradas += v;
          else if (meta.classificacao === 'despesa') map[m].saidas += v;
        }
      } else if (src === 'upload' || src === 'misto' || src === 'projecao') {
        for (const e of activeEntries.filter(x => x.data.startsWith(m))) {
          if (!includeEntry(e, src)) continue;
          const cls = getEffectiveClassification(e, classifications);
          if (cls === 'receita') map[m].entradas += e.valor;
          else if (cls === 'despesa') map[m].saidas += e.valor;
        }
      }
    }
    return Object.entries(map)
      .filter(([, v]) => v.entradas > 0 || v.saidas > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes: mes.split('-').reverse().join('/'), entradas: v.entradas, saidas: v.saidas }));
  }, [selectedMonths, monthSources, historicalRows, activeEntries, classifications, snapshotMap, modelItems]);

  // ─── Gráfico de linhas ANUAL: Entradas/Saídas por mês, com acúmulo de anos ───
  // Independe do filtro de período — usa TODOS os dados disponíveis (uploads + histórico).
  const annualLineChart = useMemo(() => {
    const histMonthsSet = new Set(historicalRows.map(r => r.month));
    const uploadMonthsSet = new Set(activeEntries.filter(e => e.origem === 'fluxo').map(e => e.data.slice(0, 7)));
    const snapMonthsSet = new Set(snapshotMap.keys());

    const map: Record<string, { entradas: number; saidas: number }> = {};
    const ensure = (m: string) => {
      if (!map[m]) map[m] = { entradas: 0, saidas: 0 };
      return map[m];
    };

    // Snapshots: prioridade máxima — substitui qualquer outra fonte
    for (const [m, snap] of snapshotMap.entries()) {
      ensure(m).entradas = snap.receitas;
      ensure(m).saidas = snap.despesas;
    }

    // Lançamentos (ignora meses com snapshot OU histórico — histórico é fonte de verdade)
    for (const e of activeEntries) {
      const m = e.data.slice(0, 7);
      if (snapMonthsSet.has(m)) continue;
      if (histMonthsSet.has(m)) continue;
      // Em meses com fluxo: aceita fluxo, manuais e projeções futuras
      if (uploadMonthsSet.has(m)) {
        if (e.origem === 'fluxo' || e.origem === 'manual') {
          // ok
        } else if (e.tipoRegistro === 'projetado' && e.data >= todayStr) {
          // ok
        } else continue;
      }
      const cls = getEffectiveClassification(e, classifications);
      if (cls === 'receita') ensure(m).entradas += e.valor;
      else if (cls === 'despesa') ensure(m).saidas += e.valor;
    }

    // Histórico (apenas meses sem snapshot) — sempre prevalece sobre upload
    for (const r of historicalRows) {
      if (snapMonthsSet.has(r.month)) continue;
      const meta = resolveTipoMeta(r.tipo_valor, classifications, modelItems);
      if (!meta.entraNoResultado) continue;
      const v = Number(r.valor) || 0;
      if (meta.classificacao === 'receita') ensure(r.month).entradas += v;
      else if (meta.classificacao === 'despesa') ensure(r.month).saidas += v;
    }

    // Reorganiza por (mês 01-12) com séries por ano
    // Ex: { mes: 'Jan', 'entradas_2024': 1000, 'saidas_2024': 500, 'entradas_2025': 1500, ... }
    const yearsSet = new Set<string>();
    const monthBuckets: Record<string, Record<string, number>> = {};
    const MES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    for (let i = 1; i <= 12; i++) {
      const mm = String(i).padStart(2, '0');
      monthBuckets[mm] = { __label: MES_LABELS[i - 1] as any };
    }
    for (const [ym, vals] of Object.entries(map)) {
      const [yyyy, mm] = ym.split('-');
      if (!monthBuckets[mm]) continue;
      yearsSet.add(yyyy);
      monthBuckets[mm][`entradas_${yyyy}`] = (monthBuckets[mm][`entradas_${yyyy}`] || 0) + vals.entradas;
      monthBuckets[mm][`saidas_${yyyy}`] = (monthBuckets[mm][`saidas_${yyyy}`] || 0) + vals.saidas;
    }
    const years = Array.from(yearsSet).sort();

    // YTD: limita comparação ao último mês com dados no ano corrente.
    // Todos os anos só exibem meses até esse limite (Jan→ÚltimoMês).
    const currentYear = String(new Date().getFullYear());
    let cutoffMM = '12';
    if (years.includes(currentYear)) {
      const monthsCurr = Object.keys(map)
        .filter(ym => ym.startsWith(currentYear))
        .map(ym => ym.split('-')[1])
        .sort();
      if (monthsCurr.length > 0) cutoffMM = monthsCurr[monthsCurr.length - 1];
    }

    const data = Object.keys(monthBuckets)
      .sort()
      .filter(mm => mm <= cutoffMM)
      .map(mm => ({ mes: monthBuckets[mm].__label as any, ...monthBuckets[mm] }))
      .map(({ __label, ...rest }: any) => rest);
    return { data, years };
  }, [activeEntries, historicalRows, classifications, snapshotMap, todayStr, modelItems]);

  const negativeDays = useMemo(() => projectionData.filter(d => d.saldo < 0), [projectionData]);
  const firstNegativeDay = negativeDays.length > 0 ? negativeDays[0] : null;
  const topOutflowDays = useMemo(() => {
    return [...projectionData].sort((a, b) => b.saidas - a.saidas).slice(0, 3).filter(d => d.saidas > 0);
  }, [projectionData]);

  // Top expense categories (apenas de lançamentos)
  const topExpenseCategories = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of selectedMonths) {
      const src = monthSources[m];
      if (src === 'historico' || src === 'vazio' || src === 'snapshot' || !src) continue;
      for (const e of activeEntries.filter(x => x.data.startsWith(m))) {
        if (!includeEntry(e, src)) continue;
        const cls = getEffectiveClassification(e, classifications);
        if (cls !== 'despesa') continue;
        const cat = e.categoria || 'Sem categoria';
        map[cat] = (map[cat] || 0) + e.valor;
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [selectedMonths, monthSources, activeEntries, classifications]);

  const monthExtremes = useMemo(() => {
    if (monthlyChart.length < 2) return null;
    const withResult = monthlyChart.map(m => ({ ...m, resultado: m.entradas - m.saidas }));
    const best = [...withResult].sort((a, b) => b.resultado - a.resultado)[0];
    const worst = [...withResult].sort((a, b) => a.resultado - b.resultado)[0];
    return { best, worst };
  }, [monthlyChart]);

  // Insights
  const insights = useMemo<Insight[]>(() => {
    const list: Insight[] = [];
    if (firstNegativeDay) {
      list.push({
        id: 'neg-saldo', tone: 'danger', icon: AlertTriangle,
        title: `Saldo ficará negativo em ${firstNegativeDay.fullDate.split('-').reverse().join('/')}`,
        description: `Saldo projetado: ${formatCurrency(firstNegativeDay.saldo)}${negativeDays.length > 1 ? ` — ${negativeDays.length} dias críticos` : ''}`,
      });
    }
    if (saldoFinal < saldoInicialCalculado) {
      list.push({ id: 'queda-saldo', tone: 'warning', icon: TrendingDown,
        title: 'Queda de caixa no período',
        description: `Saldo cai ${formatCurrency(saldoInicialCalculado - saldoFinal)} até o fim do período.` });
    } else if (saldoFinal > saldoInicialCalculado) {
      list.push({ id: 'cresce-saldo', tone: 'success', icon: TrendingUp,
        title: 'Caixa em crescimento',
        description: `Saldo cresce ${formatCurrency(saldoFinal - saldoInicialCalculado)} no período.` });
    }
    if (totals.despesas > 0 && totals.receitas > 0) {
      const ratio = (totals.despesas / totals.receitas) * 100;
      if (ratio > 90) {
        list.push({ id: 'comprometimento', tone: 'warning', icon: Flame,
          title: `Despesas comprometem ${ratio.toFixed(0)}% das receitas`,
          description: 'Margem operacional está apertada — atenção a gastos extras.' });
      } else if (ratio < 70) {
        list.push({ id: 'margem-folga', tone: 'success', icon: PiggyBank,
          title: `Boa margem: despesas em ${ratio.toFixed(0)}% das receitas`,
          description: 'Sobra de caixa saudável no período.' });
      }
    }
    if (topExpenseCategories.length > 0) {
      const [cat, val] = topExpenseCategories[0];
      const pct = totals.despesas > 0 ? (val / totals.despesas) * 100 : 0;
      if (pct > 30) {
        list.push({ id: 'maior-categoria', tone: 'info', icon: Sparkles,
          title: `${cat} concentra ${pct.toFixed(0)}% das despesas`,
          description: `Total: ${formatCurrency(val)}` });
      }
    }
    if (topOutflowDays.length > 0) {
      list.push({ id: 'top-saidas', tone: 'warning', icon: AlertTriangle,
        title: `Maior saída prevista em ${topOutflowDays[0].fullDate.split('-').reverse().join('/')}`,
        description: `${formatCurrency(topOutflowDays[0].saidas)} concentrado em um único dia.` });
    }
    if (monthExtremes && monthlyChart.length >= 2) {
      list.push({ id: 'melhor-mes', tone: 'success', icon: TrendingUp,
        title: `Melhor mês: ${monthExtremes.best.mes}`,
        description: `Resultado: ${formatCurrency(monthExtremes.best.resultado)}` });
    }
    return list;
  }, [firstNegativeDay, negativeDays, saldoFinal, saldoInicialCalculado, totals, topExpenseCategories, topOutflowDays, monthExtremes, monthlyChart]);

  // Badge label de fonte
  const sourceBadge = useMemo(() => {
    const parts: string[] = [];
    if (sourcesUsed.hasUpload) parts.push('Upload');
    if (sourcesUsed.hasHistorico) parts.push('Histórico');
    if (sourcesUsed.hasProjecao) parts.push('Projeção');
    return parts.join(' + ');
  }, [sourcesUsed]);

  return (
    <div className="space-y-6">
      {!isPresentationMode && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setShowInsights(!showInsights)}>
            {showInsights ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
            {showInsights ? 'Ocultar insights' : 'Mostrar insights'}
          </Button>
        </div>
      )}

      {showInsights && <InsightsBar insights={insights} title="Insights & Alertas" emptyHint="Sem alertas relevantes para este período." />}

      {/* KPIs Fixos: Saldo Inicial + Resultado + Saldo Final */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" /> {hasRealizado ? 'Resultado do Período' : 'Projeção do Período'}
          {sourceBadge && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold normal-case tracking-normal">
              {sourceBadge}
            </span>
          )}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Wallet, label: 'Saldo Inicial', value: saldoInicialCalculado, color: 'text-foreground' },
            { icon: Target, label: 'Resultado', value: totals.resultado, color: totals.resultado >= 0 ? 'text-success' : 'text-destructive' },
            { icon: CalendarCheck, label: 'Saldo Final', value: saldoFinal, color: saldoFinal >= 0 ? 'text-success' : 'text-destructive' },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-display font-bold ${kpi.color}`}>{formatCurrency(kpi.value)}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* KPIs DINÂMICOS por tipo */}
      {tipoAggregations.filter(a => a.entraNoResultado).length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" /> Por Tipo Financeiro
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tipoAggregations.filter(a => a.entraNoResultado).map((a, i) => {
              const Icon = a.classificacao === 'receita' ? ArrowUp : a.classificacao === 'despesa' ? ArrowDown : Coins;
              const color = a.classificacao === 'receita' ? 'text-success' : a.classificacao === 'despesa' ? 'text-destructive' : 'text-muted-foreground';
              const accent = a.classificacao === 'receita' ? 'bg-success/10 text-success' : a.classificacao === 'despesa' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground';
              return (
                <motion.div key={a.key} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass-card rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${color}`} />
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">{a.label}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${accent}`}>{a.classificacao}</span>
                  </div>
                  <p className={`text-xl font-display font-bold ${color}`}>{formatCurrency(a.valor)}</p>
                  {!a.entraNoResultado && (
                    <p className="text-[10px] text-muted-foreground mt-1">Não entra no resultado</p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Operações Financeiras */}
      {tipoAggregations.filter(a => !a.entraNoResultado && a.impactaCaixa).length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
            <Coins className="w-4 h-4" /> Operações Financeiras
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tipoAggregations.filter(a => !a.entraNoResultado && a.impactaCaixa).map((a, i) => {
              const Icon = a.isEntrada ? ArrowUp : ArrowDown;
              const color = a.isEntrada ? 'text-success' : 'text-destructive';
              const accent = a.isEntrada ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive';
              const label = a.isEntrada ? 'Entrada' : 'Saída';
              return (
                <motion.div key={a.key} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass-card rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${color}`} />
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">{a.label}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${accent}`}>{label}</span>
                  </div>
                  <p className={`text-xl font-display font-bold ${color}`}>{formatCurrency(a.valor)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Não entra no resultado</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Operações */}
      {(totals.operacoesIn > 0 || totals.operacoesOut > 0) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="glass-card rounded-xl p-4">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">💼 Operações (não entram no resultado)</h4>
          <div className="flex flex-wrap gap-6 text-sm">
            <span className="text-success">Entradas: {formatCurrency(totals.operacoesIn)}</span>
            <span className="text-destructive">Saídas: {formatCurrency(totals.operacoesOut)}</span>
            <span className="text-muted-foreground">Líquido: {formatCurrency(totals.operacoesIn - totals.operacoesOut)}</span>
          </div>
        </motion.div>
      )}

      {/* Investimentos */}
      <InvestimentoSection schoolId={schoolId} selectedMonth={selectedMonth} />


      {/* Realizado vs Projetado - apenas se houver lançamentos (não para meses só-histórico) */}
      {hasRealizado && (sourcesUsed.hasUpload || sourcesUsed.hasProjecao) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5">
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">✔ Realizado</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Receitas</span>
                <p className="text-lg font-display font-bold text-success">{formatCurrency(realizadoTotals.receitas)}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Despesas</span>
                <p className="text-lg font-display font-bold text-destructive">{formatCurrency(realizadoTotals.despesas)}</p>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-border/30">
              <span className="text-[10px] text-muted-foreground uppercase">Resultado Realizado</span>
              <p className={`text-lg font-display font-bold ${realizadoTotals.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(realizadoTotals.resultado)}
              </p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card rounded-xl p-5">
            <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-3">📊 Projetado</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Receitas Futuras</span>
                <p className="text-lg font-display font-bold text-success">{formatCurrency(projetadoTotals.receitas)}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Despesas Futuras</span>
                <p className="text-lg font-display font-bold text-destructive">{formatCurrency(projetadoTotals.despesas)}</p>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-border/30">
              <span className="text-[10px] text-muted-foreground uppercase">Resultado Projetado</span>
              <p className={`text-lg font-display font-bold ${projetadoTotals.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(projetadoTotals.resultado)}
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Comparativo Previsto x Realizado */}
      {hasRealizado && (sourcesUsed.hasUpload || sourcesUsed.hasProjecao) && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
          className="glass-card rounded-xl p-5">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            ⚖️ Previsto x Realizado
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(() => {
              const blocks: Array<{ titulo: string; previsto: number; realizado: number; kind: 'receita' | 'despesa' }> = [
                { titulo: 'RECEITAS', previsto: projetadoTotals.receitas + realizadoTotals.receitas, realizado: realizadoTotals.receitas, kind: 'receita' },
                { titulo: 'DESPESAS', previsto: projetadoTotals.despesas + realizadoTotals.despesas, realizado: realizadoTotals.despesas, kind: 'despesa' },
              ];
              return blocks.map((b) => {
                const diff = b.realizado - b.previsto;
                const pct = b.previsto > 0 ? (diff / b.previsto) * 100 : 0;
                const good = b.kind === 'receita' ? diff >= 0 : diff <= 0;
                const diffColor = good ? 'text-success' : 'text-destructive';
                return (
                  <div key={b.titulo} className="rounded-lg border border-border/40 p-4 bg-surface/40">
                    <h5 className="text-[11px] font-bold tracking-widest text-muted-foreground mb-3">{b.titulo}</h5>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Prevista</span><span className="font-semibold">{formatCurrency(b.previsto)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Realizada</span><span className="font-semibold">{formatCurrency(b.realizado)}</span></div>
                      <div className="flex justify-between border-t border-border/40 pt-1.5 mt-1.5">
                        <span className="text-muted-foreground">Diferença</span>
                        <span className={`font-bold ${diffColor}`}>
                          {diff >= 0 ? '+' : ''}{formatCurrency(diff)}{' '}
                          <span className="text-xs font-normal">({diff >= 0 ? '+' : ''}{pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Previsto = projeções (Sponte/Cheques/Cartões/Contas a Pagar) + realizado já lançado no período. Realizado = Fluxo de Caixa + manuais realizados.
          </p>
        </motion.div>
      )}



      {/* Entradas vs Saídas Bar Chart (mensal — sempre disponível, inclusive só-histórico) */}
      {monthlyChart.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass-card rounded-xl p-5">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">📊 Entradas vs Saídas</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{
                  backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px',
                }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Comparativo Anual de Entradas vs Saídas (linhas, série por ano) */}
      {annualLineChart.years.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
          className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              📈 Comparativo Anual — Entradas vs Saídas
            </h4>
            <span className="text-[10px] text-muted-foreground">
              {annualLineChart.years.length} ano{annualLineChart.years.length > 1 ? 's' : ''} acumulado{annualLineChart.years.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={annualLineChart.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {annualLineChart.years.map((year, idx) => {
                  // Cor distinta por ano (paleta diversa, alto contraste)
                  const YEAR_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
                  const color = YEAR_PALETTE[idx % YEAR_PALETTE.length];
                  return [
                    <Line
                      key={`entradas-${year}`}
                      type="monotone"
                      dataKey={`entradas_${year}`}
                      name={`Entradas ${year}`}
                      stroke={color}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: color }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />,
                    <Line
                      key={`saidas-${year}`}
                      type="monotone"
                      dataKey={`saidas_${year}`}
                      name={`Saídas ${year}`}
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={{ r: 3, fill: color }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />,
                  ];
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Cada ano tem uma cor distinta · linhas contínuas = Entradas · linhas tracejadas = Saídas.
          </p>
        </motion.div>
      )}

      {/* Projeção de Saldo Diário — OCULTO em meses só-histórico */}
      {!sourcesUsed.onlyHistorico && projectionData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="glass-card rounded-xl p-5">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">📈 Projeção de Saldo</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projectionData}>
                <defs>
                  <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="data" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => `Data: ${label}`}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="saldo" stroke="hsl(var(--success))" fill="url(#saldoGrad)" strokeWidth={2} name="Saldo" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Recebíveis — apenas quando há lançamentos (não em só-histórico) */}
      {!sourcesUsed.onlyHistorico && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
            💳 Recebíveis por Origem
          </h3>
          <Receivables schoolId={schoolId} selectedMonth={selectedMonth} />
        </motion.div>
      )}
    </div>
  );
}
