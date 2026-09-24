import { useMemo, useRef, useState, useCallback } from 'react';
import { useQuery, useIsFetching } from '@tanstack/react-query';
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
  computeSaldoInicialRealizado,
  computeSaldoFinalRealizado,
  prevMonth,
  includeEntryForMonth,
  computeFluxoCutoff,

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
import { UnclassifiedAlert } from '@/components/UnclassifiedAlert';
import { InvestimentoSection } from '@/components/InvestimentoSection';
import { ManualCardsSection } from '@/components/dashboard/ManualCardsSection';
import { ResumoMensalImagem } from '@/components/dashboard/ResumoMensalImagem';
import { ProjecaoNotas } from '@/components/dashboard/ProjecaoNotas';
import { ExportProjecaoPdf } from '@/components/dashboard/ExportProjecaoPdf';
import { ExportMesCompletoPdf } from '@/components/dashboard/ExportMesCompletoPdf';
import type { MesCompletoData } from '@/components/dashboard/pdf/mesCompletoPdf';
import { categorizeReceivable, RECEIVABLE_CONFIG } from '@/lib/receivableCategorization';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileSection } from '@/components/mobile/MobileSection';
import { CompactStat } from '@/components/mobile/CompactStat';
import { useChartPresets, ChartScroller } from '@/components/mobile/chartPresets';
import { fetchAllRows } from '@/lib/fetchAll';


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
  const { ctx: movementCtx, isLoading: movementLoading } = usePeriodMovementCtx(schoolId);
  // O PDF só pode ser gerado quando TODOS os dados da tela terminaram de
  // carregar; caso contrário ele sairia com meses/operações parciais.
  const fetchingCount = useIsFetching();
  const reportDataReady = !!school && !movementLoading && fetchingCount === 0;
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

  // Dados gerenciais complementares do relatório geral. Os totais financeiros
  // continuam vindo exclusivamente de monthMovements (SSOT).
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
    const fluxoCutoff = src === 'fluxo' ? computeFluxoCutoff(pe.dataProjetada.slice(0, 7), movementCtx) : undefined;
    return includeEntryForMonth(pe, src, todayStr, classifications, { fluxoCutoff });
  }, [todayStr, classifications, movementCtx]);


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

  // ─── Resultado Realizado (exibição) — apenas movimentações efetivamente realizadas ───
  // Não substitui `totals`; é um cálculo paralelo só para os KPIs do topo.
  const totalsRealizado = useMemo(() => {
    let receitasRealizadas = 0, despesasRealizadas = 0;
    for (const mv of monthMovements) {
      receitasRealizadas += mv.receitasRealizadas;
      despesasRealizadas += mv.despesasRealizadas;
    }
    return { receitas: receitasRealizadas, despesas: despesasRealizadas, resultado: receitasRealizadas - despesasRealizadas };
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

  // ─── Saldo Inicial Realizado (exibição) — mesma lógica do saldoInicialCalculado, porém "realizado" ───
  const saldoInicialCalculadoRealizado = useMemo(() => {
    if (selectedMonth === 'all' || selectedMonths.length === 0) return saldoInicial;
    return computeSaldoInicialRealizado(selectedMonths[0], movementCtx, { isInModel });
  }, [selectedMonth, selectedMonths, saldoInicial, movementCtx, isInModel]);

  // ─── Saldo Final Realizado (exibição) — Saldo Inicial Real + Resultado Realizado ───
  // Não substitui `saldoFinal` (que continua sendo usado pela herança de saldo entre meses,
  // projeções e demais telas). É apenas a versão "realizado" para os KPIs do topo.
  const saldoFinalRealizado = useMemo(() => {
    if (selectedMonth === 'all' || selectedMonths.length === 0) {
      let saldo = saldoInicialCalculadoRealizado;
      for (const mv of monthMovements) saldo += mv.saldoMovimentoRealizado;
      return saldo;
    }
    return computeSaldoFinalRealizado(selectedMonths[selectedMonths.length - 1], movementCtx, { isInModel });
  }, [selectedMonth, selectedMonths, saldoInicialCalculadoRealizado, monthMovements, movementCtx, isInModel]);

  // Em períodos longos, o saldo é consolidado por mês usando exclusivamente
  // as funções canônicas de saldo. O primeiro ponto dá contexto ao fechamento.
  const monthlyBalanceData = useMemo(() => {
    if (selectedMonths.length < 2) return [];
    const shortMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const firstMonth = selectedMonths[0];
    const initial = computeSaldoInicial(firstMonth, movementCtx, { isInModel });
    let previous = initial;
    const points = selectedMonths.map(month => {
      const [year, monthNumber] = month.split('-');
      const saldo = computeSaldoFinal(month, movementCtx, { isInModel });
      const point = {
        key: month,
        label: `${shortMonths[Number(monthNumber) - 1]}/${year.slice(2)}`,
        fullLabel: `${shortMonths[Number(monthNumber) - 1]} de ${year}`,
        saldo,
        variacao: saldo - previous,
      };
      previous = saldo;
      return point;
    });
    return [
      { key: 'initial', label: 'Início', fullLabel: 'Saldo inicial', saldo: initial, variacao: 0 },
      ...points,
    ];
  }, [selectedMonths, movementCtx, isInModel]);

  const monthlyBalanceSummary = useMemo(() => {
    const closings = monthlyBalanceData.filter(point => point.key !== 'initial');
    if (closings.length === 0) return null;
    return {
      minimum: closings.reduce((lowest, point) => point.saldo < lowest.saldo ? point : lowest),
      final: closings[closings.length - 1],
    };
  }, [monthlyBalanceData]);

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
      } else if (src === 'fluxo' || src === 'projecao') {
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
      // Em meses com fluxo: o realizado substitui integralmente a projeção.
      // Aceita apenas fluxo e manual — projeções (mesmo futuras) NÃO entram.
      if (uploadMonthsSet.has(m)) {
        if (e.origem !== 'fluxo' && e.origem !== 'manual') continue;
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

    // Acumulado por série (até o último mês exibido)
    const seriesTotals: Record<string, number> = {};
    for (const row of data) {
      for (const [k, v] of Object.entries(row)) {
        if (k === 'mes' || typeof v !== 'number') continue;
        seriesTotals[k] = (seriesTotals[k] || 0) + v;
      }
    }
    return { data, years, seriesTotals };
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

  const exportRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const monthlyPresets = useChartPresets(monthlyChart.length);
  const annualPresets = useChartPresets(annualLineChart.data.length);
  const dailyPresets = useChartPresets(projectionData.length);

  // Item 8: meses com realizado parcial (não fechados) ficam sinalizados.
  const mesesParciais = useMemo(
    () => monthMovements.filter(m => m.parcial).map(m => ({ month: m.month, realizadoAte: m.realizadoAte })),
    [monthMovements]
  );

  // ─── Dados do PDF nativo "Mês completo" (montado só no clique) ───
  const buildMesCompletoData = useCallback(async (): Promise<MesCompletoData> => {
    const firstMonth = selectedMonths[0];
    const lastMonth = selectedMonths[selectedMonths.length - 1];
    const selectedStart = firstMonth ? `${firstMonth}-01` : undefined;
    const selectedEnd = lastMonth ? `${lastMonth}-31` : undefined;
    const comparisonYear = String(Number((lastMonth || `${new Date().getFullYear()}`).slice(0, 4)) - 1);
    const comparisonStart = firstMonth ? `${comparisonYear}-${firstMonth.slice(5, 7)}` : undefined;
    const expenseHistoryStart = `${comparisonYear}-01-01`;

    const [reportRealizedEntries, reportAccountsResult, reportKpiDefinitionsResult, reportKpiValuesResult, reportConversionResult, reportSalesResult, reportSalesMethodsResult, reportBrandsResult, reportLegacyKpisResult, reportRevenueResult, reportCeilingsResult, reportConversionThresholdsResult] = await Promise.all([
      fetchAllRows<any>('realized_entries', q => {
        let query = q.eq('school_id', schoolId);
        query = query.gte('data', expenseHistoryStart);
        if (selectedEnd) query = query.lte('data', selectedEnd);
        return query.order('data');
      }),
      supabase.from('chart_of_accounts').select('id, nome, grupo, pai_id, tipo').eq('school_id', schoolId),
      supabase.from('kpi_definitions').select('id, name, value_type, direction, decimals, sort_order').eq('school_id', schoolId).eq('enabled', true).order('sort_order'),
      supabase.from('kpi_values').select('kpi_definition_id, month, value').eq('school_id', schoolId).order('month'),
      supabase.from('conversion_data').select('month, tipo, contatos, matriculas').eq('school_id', schoolId).order('month'),
      supabase.from('sales_data').select('month, method_key, brand_id, value').eq('school_id', schoolId),
      supabase.from('sales_payment_methods').select('method_key, label, enabled').eq('school_id', schoolId),
      supabase.from('sales_card_brands').select('id, name'),
      supabase.from('school_kpis').select('month, lucratividade, inadimplencia, media_alunos_turma, alunos_modalidade, evasao').eq('school_id', schoolId).order('month'),
      supabase.from('monthly_revenue').select('month, value').eq('school_id', schoolId).order('month'),
      supabase.from('expense_ceilings').select('category_name, ceiling, scope, parent_group, semester').eq('school_id', schoolId),
      supabase.from('conversion_thresholds').select('tipo, min_value, max_value, label').eq('school_id', schoolId).order('sort_order'),
    ]);
    if (reportAccountsResult.error) throw reportAccountsResult.error;
    if (reportKpiDefinitionsResult.error) throw reportKpiDefinitionsResult.error;
    if (reportKpiValuesResult.error) throw reportKpiValuesResult.error;
    if (reportConversionResult.error) throw reportConversionResult.error;
    if (reportSalesResult.error) throw reportSalesResult.error;
    if (reportSalesMethodsResult.error) throw reportSalesMethodsResult.error;
    if (reportBrandsResult.error) throw reportBrandsResult.error;
    if (reportLegacyKpisResult.error) throw reportLegacyKpisResult.error;
    if (reportRevenueResult.error) throw reportRevenueResult.error;
    if (reportCeilingsResult.error) throw reportCeilingsResult.error;
    if (reportConversionThresholdsResult.error) throw reportConversionThresholdsResult.error;
    const reportAccounts = reportAccountsResult.data ?? [];
    const reportKpiDefinitions = reportKpiDefinitionsResult.data ?? [];
    const reportKpiValues = reportKpiValuesResult.data ?? [];
    const reportConversion = reportConversionResult.data ?? [];
    const reportSales = reportSalesResult.data ?? [];
    const reportSalesMethods = reportSalesMethodsResult.data ?? [];
    const reportBrands = reportBrandsResult.data ?? [];
    const reportLegacyKpis = reportLegacyKpisResult.data ?? [];
    const reportRevenue = reportRevenueResult.data ?? [];
    const reportCeilings = reportCeilingsResult.data ?? [];
    const reportConversionThresholds = reportConversionThresholdsResult.data ?? [];
    const kpiIds = reportKpiDefinitions.map(row => row.id);
    const reportKpiThresholds = kpiIds.length
      ? (await supabase.from('kpi_thresholds').select('kpi_definition_id, min_value, max_value, color, label, sort_order').in('kpi_definition_id', kpiIds).order('sort_order')).data ?? []
      : [];
    const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const labelOf = (m: string) => {
      const [yy, mm] = m.split('-');
      return `${monthNames[parseInt(mm, 10) - 1]} de ${yy}`;
    };
    const periodoLabel =
      selectedMonths.length === 0 ? 'Todo o período'
      : selectedMonths.length === 1 ? labelOf(selectedMonths[0])
      : `${labelOf(selectedMonths[0])} a ${labelOf(selectedMonths[selectedMonths.length - 1])}`;

    // Lançamentos do período, respeitando a fonte da verdade de cada mês.
    const periodEntries = activeEntries.filter(e => {
      const m = (e.data || '').slice(0, 7);
      if (selectedMonths.length > 0 && !selectedMonths.includes(m)) return false;
      if (selectedMonths.length === 0 && !matchesMonthFilter(e.data, selectedMonth)) return false;
      return includeEntry(e, monthSources[m] ?? 'projecao');
    });

    // Recebíveis por forma de cobrança
    const recMap: Record<string, number> = {};
    // Contas a pagar por categoria + favorecido
    const pagMap: Record<string, { label: string; sub: string; valor: number }> = {};
    periodEntries.forEach(e => {
      const cls = getEffectiveClassification(e as any, classifications);
      if (cls === 'receita') {
        const key = RECEIVABLE_CONFIG[categorizeReceivable(e as any)]?.label || 'Outros';
        recMap[key] = (recMap[key] || 0) + Math.abs(Number(e.valor) || 0);
      } else if (cls === 'despesa') {
        const cat = (e.categoria || 'Sem categoria').trim() || 'Sem categoria';
        const fav = (e.descricao || '—').trim() || '—';
        const k = `${cat}||${fav}`;
        if (!pagMap[k]) pagMap[k] = { label: cat, sub: fav, valor: 0 };
        pagMap[k].valor += Math.abs(Number(e.valor) || 0);
      }
    });

    // Mês anterior para comparação
    let anterior: MesCompletoData['anterior'];
    if (selectedMonths.length > 0) {
      const prev = prevMonth(selectedMonths[0]);
      const mv = buildMonthMovement(prev, movementCtx, { isInModel });
      if (mv.receitas !== 0 || mv.despesas !== 0) {
        anterior = {
          label: labelOf(prev),
          receitas: mv.receitas,
          despesas: mv.despesas,
          resultado: mv.receitas - mv.despesas,
          saldoFinal: computeSaldoFinal(prev, movementCtx, { isInModel }),
        };
      }
    }

    const sourceLabels: Record<string, string> = {
      snapshot: 'Fechamento', fluxo: 'Realizado + previsão', historico: 'Histórico', projecao: 'Projeção', vazio: 'Sem dados',
    };
    const monthly = monthMovements.map((mv) => ({
      month: mv.month,
      label: `${monthNames[Number(mv.month.slice(5, 7)) - 1].slice(0, 3)}/${mv.month.slice(2, 4)}`,
      source: sourceLabels[mv.source] || mv.source,
      saldoInicial: computeSaldoInicial(mv.month, movementCtx, { isInModel }),
      receitas: mv.receitas,
      despesas: mv.despesas,
      receitasRealizadas: mv.receitasRealizadas,
      despesasRealizadas: mv.despesasRealizadas,
      receitasPrevistas: Math.max(0, mv.receitas - mv.receitasRealizadas),
      despesasPrevistas: Math.max(0, mv.despesas - mv.despesasRealizadas),
      resultado: mv.receitas - mv.despesas,
      operacoesIn: mv.operacoesIn,
      operacoesOut: mv.operacoesOut,
      saldoFinal: computeSaldoFinal(mv.month, movementCtx, { isInModel }),
    }));

    const reportReferenceMonth = selectedMonths[selectedMonths.length - 1] || `${new Date().getFullYear()}-12`;
    const reportCurrentYear = reportReferenceMonth.slice(0, 4);
    const reportPreviousYear = String(Number(reportCurrentYear) - 1);
    const annualYears = [reportPreviousYear, reportCurrentYear];
    const buildAnnual = (kind: 'receitas' | 'despesas' | 'resultado') => annualYears.map(year => ({
      year,
      months: Array.from({ length: 12 }, (_, index) => {
        const month = `${year}-${String(index + 1).padStart(2, '0')}`;
        if (month > reportReferenceMonth) return null;
        const movement = buildMonthMovement(month, movementCtx, { isInModel });
        if (movement.source === 'vazio') return null;
        const value = kind === 'resultado' ? movement.receitas - movement.despesas : movement[kind];
        return value;
      }),
    }));


    const accountMap = new Map(reportAccounts.map((a: any) => [a.id, a]));
    const accountByName = new Map(reportAccounts.map((a: any) => [normalizeTipo(a.nome), a]));
    const realizedByKey = new Map<string, any[]>();
    reportRealizedEntries
      .filter((entry: any) => selectedMonths.includes(String(entry.data).slice(0, 7)) && entry.tipo === 'despesa')
      .forEach((entry: any) => {
        const key = `${entry.data}|${normalizeTipo(entry.descricao)}|${Number(entry.valor).toFixed(2)}`;
        const rows = realizedByKey.get(key) ?? [];
        rows.push(entry);
        realizedByKey.set(key, rows);
      });
    const expenseMap = new Map<string, { mae: string; filha: string; valor: number }>();
    const matchedRealizedIds = new Set<string>();
    periodEntries
      .filter(entry => getEffectiveClassification(entry as any, classifications) === 'despesa')
      .forEach(entry => {
        const matchKey = `${entry.data}|${normalizeTipo(entry.descricao)}|${Number(entry.valor).toFixed(2)}`;
        const candidates = realizedByKey.get(matchKey) ?? [];
        const realized = candidates.find(candidate => !matchedRealizedIds.has(candidate.id));
        if (realized) matchedRealizedIds.add(realized.id);
        const account: any = realized?.conta_id
          ? accountMap.get(realized.conta_id)
          : accountByName.get(normalizeTipo(realized?.conta_nome || ''));
        const parent: any = account?.pai_id ? accountMap.get(account.pai_id) : null;
        const mae = parent?.nome || account?.grupo || (account && !account.pai_id ? account.nome : 'Pendente de classificação');
        const filha = parent ? account.nome : (account?.nome || realized?.conta_nome || entry.categoria || entry.descricao || '(sem subcategoria)');
        const key = `${mae}||${filha}`;
        const current = expenseMap.get(key) || { mae, filha, valor: 0 };
        current.valor += Math.abs(Number(entry.valor) || 0);
        expenseMap.set(key, current);
      });
    const expenses = Array.from(expenseMap.values()).sort((a, b) => b.valor - a.valor);
    const expenseDetailTotal = expenses.reduce((sum, row) => sum + row.valor, 0);
    // Mesma composição exibida em Relatório Realizado > Análise de Despesas:
    // todos os lançamentos realizados do período, agrupados pelo grupo da conta.
    const analysisExpenseMap = new Map<string, { mae: string; filha: string; valor: number }>();
    reportRealizedEntries
      .filter((entry: any) => selectedMonths.includes(String(entry.data).slice(0, 7)) && entry.tipo === 'despesa')
      .forEach((entry: any) => {
        const account: any = entry.conta_id
          ? accountMap.get(entry.conta_id)
          : accountByName.get(normalizeTipo(entry.conta_nome || ''));
        const parent: any = account?.pai_id ? accountMap.get(account.pai_id) : null;
        const mae = parent?.nome || account?.grupo || 'Outros';
        const filha = parent ? account.nome : (account?.nome || entry.conta_nome || 'Sem categoria');
        const key = `${mae}||${filha}`;
        const current = analysisExpenseMap.get(key) ?? { mae, filha, valor: 0 };
        current.valor += Math.abs(Number(entry.valor) || 0);
        analysisExpenseMap.set(key, current);
      });
    const analysisExpenses = Array.from(analysisExpenseMap.values()).sort((a, b) => b.valor - a.valor);
    const analysisExpenseTotal = analysisExpenses.reduce((sum, row) => sum + row.valor, 0);
    const rawExpenseTotal = reportRealizedEntries
      .filter((entry: any) => selectedMonths.includes(String(entry.data).slice(0, 7)) && entry.tipo === 'despesa')
      .reduce((sum: number, entry: any) => sum + Math.abs(Number(entry.valor) || 0), 0);
    const excludedExpenseRows = reportRealizedEntries
      .filter((entry: any) => selectedMonths.includes(String(entry.data).slice(0, 7)) && entry.tipo === 'despesa' && !matchedRealizedIds.has(entry.id))
      .map((entry: any) => ({
        date: entry.data,
        description: entry.descricao,
        account: entry.conta_nome || 'Sem conta',
        value: Math.abs(Number(entry.valor) || 0),
    reason: 'Sem correspondência inequívoca com a despesa oficial',
      }))
      .sort((a: any, b: any) => b.value - a.value);
    const expenseHistoryMap = new Map<string, { category: string; year: string; months: number[] }>();
    reportRealizedEntries
      .filter((entry: any) => entry.tipo === 'despesa')
      .forEach((entry: any) => {
        const account: any = entry.conta_id
          ? accountMap.get(entry.conta_id)
          : accountByName.get(normalizeTipo(entry.conta_nome || ''));
        const parent: any = account?.pai_id ? accountMap.get(account.pai_id) : null;
        const category = parent?.nome || account?.grupo || (account && !account.pai_id ? account.nome : 'Pendente de classificação');
        const month = String(entry.data).slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(month)) return;
        const year = month.slice(0, 4);
        const monthIndex = Number(month.slice(5, 7)) - 1;
        const key = `${category}||${year}`;
        const row = expenseHistoryMap.get(key) ?? { category, year, months: Array(12).fill(0) };
        row.months[monthIndex] += Math.abs(Number(entry.valor) || 0);
        expenseHistoryMap.set(key, row);
      });
    const expenseHistory = Array.from(expenseHistoryMap.values()).map(row => ({
      ...row,
      months: row.months.map((value, index) => {
        const month = `${row.year}-${String(index + 1).padStart(2, '0')}`;
        return month > String(selectedEnd || '').slice(0, 7) || value === 0 ? null : value;
      }),
    }));

    const selectedSet = new Set(selectedMonths);
    const kpis = reportKpiDefinitions.map((definition: any) => {
      const allValues = reportKpiValues
        .filter((value: any) => value.kpi_definition_id === definition.id)
        .sort((a: any, b: any) => a.month.localeCompare(b.month));
      const values = allValues.filter((value: any) => selectedSet.has(value.month));
      const current = values[values.length - 1];
      const currentIndex = current ? allValues.findIndex((value: any) => value.month === current.month) : -1;
      const previous = currentIndex > 0 ? allValues[currentIndex - 1] : null;
      const numericValue = current ? Number(current.value) : null;
      const previousValue = previous ? Number(previous.value) : null;
      // Mesma regra de faixa do KpiCard online: [min, max) com fallback na última faixa.
      const definitionThresholds = reportKpiThresholds.filter((item: any) => item.kpi_definition_id === definition.id);
      const threshold = numericValue === null || !definitionThresholds.length ? null : (
        definitionThresholds.find((item: any) =>
          numericValue >= (item.min_value == null ? -Infinity : Number(item.min_value)) &&
          numericValue < (item.max_value == null ? Infinity : Number(item.max_value))
        ) ?? definitionThresholds[definitionThresholds.length - 1]
      );
      // Comparação com o ano anterior: média Jan→mês de referência (mesma regra do relatório online).
      const referenceKpiMonth = current?.month ?? selectedMonths[selectedMonths.length - 1];
      let yoy: any = null;
      if (referenceKpiMonth) {
        const year = Number(referenceKpiMonth.slice(0, 4));
        const monthIdx = Number(referenceKpiMonth.slice(5, 7));
        let sumCur = 0, cntCur = 0, sumPrev = 0, cntPrev = 0;
        for (let i = 1; i <= monthIdx; i += 1) {
          const mm = String(i).padStart(2, '0');
          const cur = allValues.find((v: any) => v.month === `${year}-${mm}`);
          const prev = allValues.find((v: any) => v.month === `${year - 1}-${mm}`);
          if (cur) { sumCur += Number(cur.value); cntCur += 1; }
          if (prev) { sumPrev += Number(prev.value); cntPrev += 1; }
        }
        if (cntCur && cntPrev) {
          const avgCurrent = sumCur / cntCur;
          const avgPrevious = sumPrev / cntPrev;
          const delta = avgCurrent - avgPrevious;
          yoy = {
            avgCurrent,
            avgPrevious,
            delta,
            relPct: avgPrevious !== 0 ? delta / Math.abs(avgPrevious) * 100 : null,
            improvement: definition.direction === 'higher_is_better' ? delta > 0 : delta < 0,
            previousYear: String(year - 1),
            monthLabel: monthNames[monthIdx - 1].slice(0, 3),
          };
        }
      }
      return {
        id: definition.id,
        name: definition.name,
        value: numericValue,
        valueType: definition.value_type,
        direction: definition.direction,
        decimals: Number(definition.decimals ?? 2),
        status: threshold?.label,
        statusColor: threshold?.color,
        previousValue,
        previousMonth: previous?.month,
        variation: numericValue !== null && previousValue !== null && previousValue !== 0 ? (numericValue - previousValue) / Math.abs(previousValue) * 100 : null,
        history: allValues.map((value: any) => ({ label: value.month, value: Number(value.value) })),
        yoy,
        thresholds: definitionThresholds
          .map((item: any) => ({ min: item.min_value == null ? null : Number(item.min_value), max: item.max_value == null ? null : Number(item.max_value), label: item.label })),
      };

    });

    const conversion = reportConversion
      .filter((row: any) => selectedSet.has(row.month))
      .map((row: any) => ({
        month: row.month,
        label: `${monthNames[Number(row.month.slice(5, 7)) - 1].slice(0, 3)}/${row.month.slice(2, 4)}`,
        tipo: row.tipo || 'geral',
        contatos: Number(row.contatos) || 0,
        matriculas: Number(row.matriculas) || 0,
        taxa: Number(row.contatos) ? Number(row.matriculas) / Number(row.contatos) * 100 : 0,
      }));

    const finalSelectedMonth = reportReferenceMonth;
    const currentYear = finalSelectedMonth.slice(0, 4);
    const previousYear = String(Number(currentYear) - 1);
    const monthIndexes = Array.from(new Set(selectedMonths.filter(month => month.startsWith(currentYear)).map(month => month.slice(5, 7))));
    const shortMonths = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const enrollmentsYoY = monthIndexes.map(month => ({
      label: shortMonths[Number(month) - 1],
      current: reportConversion.filter((row: any) => row.month === `${currentYear}-${month}`).reduce((sum: number, row: any) => sum + (Number(row.matriculas) || 0), 0),
      previous: reportConversion.filter((row: any) => row.month === `${previousYear}-${month}`).reduce((sum: number, row: any) => sum + (Number(row.matriculas) || 0), 0),
    }));

    const methodLabels = new Map(reportSalesMethods.filter((row: any) => row.enabled).map((row: any) => [row.method_key, row.label || row.method_key]));
    const brandLabels = new Map(reportBrands.map((row: any) => [row.id, row.name]));
    const allowedSalesMethods = new Set(['credito', 'debito', 'pix', 'boleto']);
    const sales = reportSales
      .filter((row: any) => selectedSet.has(row.month) && allowedSalesMethods.has(row.method_key))
      .map((row: any) => ({
        month: row.month,
        method: row.method_key === 'credito' || row.method_key === 'debito' ? 'Cartão' : (methodLabels.get(row.method_key) || row.method_key),
        brand: row.brand_id ? brandLabels.get(row.brand_id) : undefined,
        value: Number(row.value) || 0,
      }));

    const legacyKpis = reportLegacyKpis.map((row: any) => ({
      month: row.month,
      lucratividade: row.lucratividade == null ? null : Number(row.lucratividade),
      inadimplencia: row.inadimplencia == null ? null : Number(row.inadimplencia),
      mediaAlunosTurma: row.media_alunos_turma == null ? null : Number(row.media_alunos_turma),
      alunosModalidade: row.alunos_modalidade == null ? null : Number(row.alunos_modalidade),
      evasao: row.evasao == null ? null : Number(row.evasao),
    }));

    // Espelha exatamente os mesmos itens exibidos em "Operações Financeiras"
    // no Dashboard; o PDF não reclassifica nem reconstrói esses valores.
    const reportOperations = tipoAggregations
      .filter(item => !item.entraNoResultado && item.impactaCaixa)
      .map(item => ({ label: item.label, valor: item.valor, isEntrada: item.isEntrada }));

    return {
      schoolName: school?.nome || 'Empresa',
      periodoLabel,
      // O resumo do PDF espelha os cartões principais do Dashboard: visão realizada.
      saldoInicial: saldoInicialCalculadoRealizado,
      saldoFinal: saldoFinalRealizado,
      receitas: totalsRealizado.receitas,
      despesas: totalsRealizado.despesas,
      resultado: totalsRealizado.resultado,
      operacoesIn: totals.operacoesIn,
      operacoesOut: totals.operacoesOut,
      operations: reportOperations,
      porTipo: tipoAggregations.map(t => ({ label: t.label, valor: t.valor, classificacao: t.classificacao })),
      recebiveis: Object.entries(recMap).map(([label, valor]) => ({ label, valor })).filter(r => r.valor > 0),
      contasPagar: Object.values(pagMap).filter(p => p.valor > 0).slice(0, 60),
      anterior,
      monthly,
      annualRevenue: buildAnnual('receitas'),
      annualExpenses: buildAnnual('despesas'),
      annualResult: buildAnnual('resultado'),

      expenses,
      expenseDetailTotal,
      analysisExpenses,
      analysisExpenseTotal,
      rawExpenseTotal,
      excludedExpenseRows,
      expenseHistory,
      monthlyRevenue: reportRevenue.map((row: any) => ({ month: row.month, value: Number(row.value) || 0 })),
      expenseCeilings: reportCeilings.map((row: any) => ({ category: row.category_name, ceiling: Number(row.ceiling) || 0, scope: row.scope, parentGroup: row.parent_group, semester: row.semester })),
      sales,
      legacyKpis,
      kpis,
      conversion,
      conversionThresholds: reportConversionThresholds.map((row: any) => ({ tipo: row.tipo, min: row.min_value == null ? null : Number(row.min_value), max: row.max_value == null ? null : Number(row.max_value), label: row.label })),
      enrollmentsYoY,
      annualEnrollments: [previousYear, currentYear].map(year => ({
        year,
        months: Array.from({ length: 12 }, (_, index) => {
          const rows = reportConversion.filter((row: any) => row.month === `${year}-${String(index + 1).padStart(2, '0')}`);
          return rows.length ? rows.reduce((sum: number, row: any) => sum + (Number(row.matriculas) || 0), 0) : null;
        }),
      })),
      annualContacts: [previousYear, currentYear].map(year => ({
        year,
        months: Array.from({ length: 12 }, (_, index) => {
          const rows = reportConversion.filter((row: any) => row.month === `${year}-${String(index + 1).padStart(2, '0')}`);
          return rows.length ? rows.reduce((sum: number, row: any) => sum + (Number(row.contatos) || 0), 0) : null;
        }),
      })),
      currentYear,
      previousYear,
      referenceMonth: finalSelectedMonth,
      sources: Array.from(new Set(monthly.map(row => row.source))),
      fileName: `relatorio-geral-${selectedMonths[0] || 'periodo'}-${selectedMonths[selectedMonths.length - 1] || 'completo'}`,
    };
  }, [activeEntries, classifications, includeEntry, monthSources, selectedMonth, selectedMonths, school, schoolId, saldoInicialCalculadoRealizado, saldoFinalRealizado, totals, totalsRealizado, tipoAggregations, movementCtx, isInModel, monthMovements]);

  return (
    <div className="space-y-3 sm:space-y-6" ref={exportRef}>
      <div className="flex flex-wrap items-center justify-end gap-2" data-export-hide>
        <ExportMesCompletoPdf buildData={buildMesCompletoData} ready={reportDataReady} />
        <ResumoMensalImagem schoolId={schoolId} selectedMonth={selectedMonth} />
        <ExportProjecaoPdf targetRef={exportRef} fileName={`projecao-${selectedMonth === 'all' ? 'periodo' : selectedMonth.replace(/,/g, '_')}`} />

        {!isPresentationMode && (
          <Button variant="ghost" size="sm" onClick={() => setShowInsights(!showInsights)}>
            {showInsights ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
            {showInsights ? 'Ocultar insights' : 'Mostrar insights'}
          </Button>
        )}
      </div>

      {mesesParciais.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 sm:px-4 sm:py-3 text-[11px] sm:text-sm leading-snug">
          <span className="font-semibold">Período em aberto (parcial).</span>{' '}
          {mesesParciais.map(m => `${m.month} realizado até ${m.realizadoAte ? m.realizadoAte.split('-').reverse().join('/') : '—'}`).join(' · ')}
          {' — '}os dias seguintes são projeção. O mês só é consolidado como realizado após o fechamento.
        </div>
      )}

      <UnclassifiedAlert
        entries={activeEntries.filter(e => selectedMonths.includes(e.data.slice(0, 7)))}
        classifications={classifications}
      />


      {showInsights && <InsightsBar insights={insights} title="Insights & Alertas" emptyHint="Sem alertas relevantes para este período." />}



      {/* KPIs Fixos: Saldo Inicial + Resultado + Saldo Final */}
      <div>
        <h3 className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 sm:mb-3 flex flex-wrap items-center gap-2">
          <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {hasRealizado ? 'Resultado do Período' : 'Projeção do Período'}
          {sourceBadge && (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold normal-case tracking-normal">
              {sourceBadge}
            </span>
          )}
        </h3>
        {isMobile ? (
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Wallet, label: 'Saldo Inicial', value: saldoInicialCalculado, color: 'text-foreground', hint: undefined as string | undefined },
              { icon: Target, label: 'Resultado', value: totalsRealizado.resultado, color: totalsRealizado.resultado >= 0 ? 'text-success' : 'text-destructive', hint: `Projetado: ${formatCurrency(totals.resultado)}` },
              { icon: ArrowUp, label: 'Receitas', value: totals.receitas, color: 'text-success', hint: undefined as string | undefined },
              { icon: ArrowDown, label: 'Despesas', value: totals.despesas, color: 'text-destructive', hint: undefined as string | undefined },
            ].map(kpi => (
              <CompactStat
                key={kpi.label}
                label={kpi.label}
                value={formatCurrency(kpi.value)}
                icon={<kpi.icon className="w-3 h-3 text-muted-foreground shrink-0" />}
                valueClassName={kpi.color}
                hint={kpi.hint}
              />
            ))}
            <div className="col-span-2">
              <CompactStat
                label="Saldo Final do Período"
                value={formatCurrency(saldoFinalRealizado)}
                icon={<CalendarCheck className="w-3 h-3 text-muted-foreground shrink-0" />}
                valueClassName={saldoFinalRealizado >= 0 ? 'text-success text-lg' : 'text-destructive text-lg'}
                hint={`Projetado: ${formatCurrency(saldoFinal)}`}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[
              { icon: Wallet, label: 'Saldo Inicial', value: saldoInicialCalculado, color: 'text-foreground', projected: undefined as number | undefined },
              { icon: Target, label: 'Resultado', value: totalsRealizado.resultado, color: totalsRealizado.resultado >= 0 ? 'text-success' : 'text-destructive', projected: totals.resultado },
              { icon: CalendarCheck, label: 'Saldo Final', value: saldoFinalRealizado, color: saldoFinalRealizado >= 0 ? 'text-success' : 'text-destructive', projected: saldoFinal },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card rounded-xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-2">
                  <kpi.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                </div>
                <p className={`text-xl sm:text-2xl font-display font-bold break-words ${kpi.color}`}>{formatCurrency(kpi.value)}</p>
                {kpi.projected !== undefined && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Projetado: {formatCurrency(kpi.projected)}</p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>



      {/* KPIs DINÂMICOS por tipo */}
      {tipoAggregations.filter(a => a.entraNoResultado).length > 0 && (
        <MobileSection
          title="Por Tipo Financeiro"
          icon={<Layers className="w-3.5 h-3.5" />}
          summary={`${tipoAggregations.filter(a => a.entraNoResultado).length} tipos`}
        >
          <h3 className="hidden sm:flex text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 items-center gap-2">
            <Layers className="w-4 h-4" /> Por Tipo Financeiro
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {tipoAggregations.filter(a => a.entraNoResultado).map((a, i) => {
              const Icon = a.classificacao === 'receita' ? ArrowUp : a.classificacao === 'despesa' ? ArrowDown : Coins;
              const color = a.classificacao === 'receita' ? 'text-success' : a.classificacao === 'despesa' ? 'text-destructive' : 'text-muted-foreground';
              const accent = a.classificacao === 'receita' ? 'bg-success/10 text-success' : a.classificacao === 'despesa' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground';
              if (isMobile) {
                return (
                  <CompactStat
                    key={a.key}
                    label={a.label}
                    value={formatCurrency(a.valor)}
                    icon={<Icon className={`w-3 h-3 shrink-0 ${color}`} />}
                    valueClassName={color}
                  />
                );
              }
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
        </MobileSection>
      )}

      {/* Operações Financeiras */}
      {tipoAggregations.filter(a => !a.entraNoResultado && a.impactaCaixa).length > 0 && (
        <MobileSection
          title="Operações Financeiras"
          icon={<Coins className="w-3.5 h-3.5" />}
          summary={`${tipoAggregations.filter(a => !a.entraNoResultado && a.impactaCaixa).length} itens`}
        >
          <h3 className="hidden sm:flex text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 items-center gap-2">
            <Coins className="w-4 h-4" /> Operações Financeiras
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {tipoAggregations.filter(a => !a.entraNoResultado && a.impactaCaixa).map((a, i) => {
              const Icon = a.isEntrada ? ArrowUp : ArrowDown;
              const color = a.isEntrada ? 'text-success' : 'text-destructive';
              const accent = a.isEntrada ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive';
              const label = a.isEntrada ? 'Entrada' : 'Saída';
              if (isMobile) {
                return (
                  <CompactStat
                    key={a.key}
                    label={a.label}
                    value={formatCurrency(a.valor)}
                    icon={<Icon className={`w-3 h-3 shrink-0 ${color}`} />}
                    valueClassName={color}
                    hint="Não entra no resultado"
                  />
                );
              }
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
        </MobileSection>
      )}


      {/* Operações (Ignorados do banco ficam fora: contam só no saldo) */}
      {(() => {
        const ign = tipoAggregations.filter(a => /^movimenta[çc][õo]es ignoradas \(banco\)/i.test(a.label));
        const ignIn = ign.filter(a => a.isEntrada).reduce((s, a) => s + a.valor, 0);
        const ignOut = ign.filter(a => !a.isEntrada).reduce((s, a) => s + a.valor, 0);
        const opIn = totals.operacoesIn - ignIn;
        const opOut = totals.operacoesOut - ignOut;
        if (opIn <= 0.004 && opOut <= 0.004 && ign.length === 0) return null;
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="glass-card rounded-xl p-3 sm:p-4">
            <h4 className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">💼 Operações (não entram no resultado)</h4>
            <div className="grid grid-cols-3 sm:flex sm:flex-wrap sm:gap-6 gap-2 text-[11px] sm:text-sm">
              <span className="text-success truncate">Entradas: {formatCurrency(opIn)}</span>
              <span className="text-destructive truncate">Saídas: {formatCurrency(opOut)}</span>
              <span className="text-muted-foreground truncate">Líquido: {formatCurrency(opIn - opOut)}</span>
            </div>
            {ign.length > 0 && (
              <p className="mt-1.5 text-[10px] sm:text-xs text-muted-foreground">Ignorados (banco), só no saldo: {formatCurrency(ignIn - ignOut)}</p>
            )}
          </motion.div>
        );
      })()}

      {/* Cards manuais (admin) — informativos, não afetam saldo/resultado */}
      <ManualCardsSection schoolId={schoolId} selectedMonth={selectedMonth} />

      {/* Investimentos */}
      <InvestimentoSection schoolId={schoolId} selectedMonth={selectedMonth} />




      {/* Realizado vs Projetado - apenas se houver lançamentos (não para meses só-histórico) */}
      {hasRealizado && (sourcesUsed.hasUpload || sourcesUsed.hasProjecao) && (
        isMobile ? (
          <MobileSection
            title="Realizado x Projetado"
            plainOnDesktop={false}
            summary={formatCurrency(realizadoTotals.resultado + projetadoTotals.resultado)}
          >
            <div className="grid grid-cols-2 gap-2">
              <CompactStat label="Rec. realizada" value={formatCurrency(realizadoTotals.receitas)} valueClassName="text-success" />
              <CompactStat label="Rec. futura" value={formatCurrency(projetadoTotals.receitas)} valueClassName="text-success" />
              <CompactStat label="Desp. realizada" value={formatCurrency(realizadoTotals.despesas)} valueClassName="text-destructive" />
              <CompactStat label="Desp. futura" value={formatCurrency(projetadoTotals.despesas)} valueClassName="text-destructive" />
              <CompactStat
                label="Result. realizado"
                value={formatCurrency(realizadoTotals.resultado)}
                valueClassName={realizadoTotals.resultado >= 0 ? 'text-success' : 'text-destructive'}
              />
              <CompactStat
                label="Result. projetado"
                value={formatCurrency(projetadoTotals.resultado)}
                valueClassName={projetadoTotals.resultado >= 0 ? 'text-success' : 'text-destructive'}
              />
            </div>
          </MobileSection>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5">
            <h4 className="text-xs font-bold text-blue-600 dark:text-blue-300 uppercase tracking-widest mb-3">✔ Realizado</h4>
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
        )
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
          className="glass-card rounded-xl p-3 sm:p-5">
          <h4 className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 sm:mb-4">📊 Entradas vs Saídas</h4>
          <ChartScroller width={monthlyPresets.scrollWidth} height={monthlyPresets.height}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChart} margin={monthlyPresets.margin}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: monthlyPresets.tickFontSize }} interval={monthlyPresets.scrollWidth ? 0 : monthlyPresets.xInterval} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: monthlyPresets.tickFontSize }} width={monthlyPresets.isMobile ? 34 : 60} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{
                  backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px',
                }} />
                {monthlyPresets.showLegend && <Legend wrapperStyle={{ fontSize: '11px' }} />}
                <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartScroller>
          {monthlyPresets.isMobile && (
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-success inline-block" />Entradas</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-destructive inline-block" />Saídas</span>
            </div>
          )}
        </motion.div>
      )}


      {/* Comparativo Anual de Entradas vs Saídas (linhas, série por ano) */}
      {annualLineChart.years.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
          className="glass-card rounded-xl p-3 sm:p-5">
          <div className="flex items-center justify-between mb-2 sm:mb-4 flex-wrap gap-2">
            <h4 className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest">
              📈 Comparativo Anual — Entradas vs Saídas
            </h4>
            <span className="text-[10px] text-muted-foreground">
              {annualLineChart.years.length} ano{annualLineChart.years.length > 1 ? 's' : ''} acumulado{annualLineChart.years.length > 1 ? 's' : ''}
            </span>
          </div>
          <ChartScroller width={annualPresets.scrollWidth} height={annualPresets.tallHeight}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={annualLineChart.data} margin={annualPresets.margin}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: annualPresets.tickFontSize }} interval={annualPresets.scrollWidth ? 0 : annualPresets.xInterval} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: annualPresets.tickFontSize }} width={annualPresets.isMobile ? 34 : 60} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />

                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px' }}
                  formatter={(value: any, entry: any) => {
                    const key = entry?.dataKey as string;
                    const total = key ? annualLineChart.seriesTotals?.[key] : undefined;
                    return total !== undefined
                      ? `${value} — ${formatCurrency(total)}`
                      : String(value);
                  }}
                />

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
          </ChartScroller>
          {annualPresets.isMobile && (
            <div className="flex flex-wrap items-center gap-2 mt-2 text-[9px] text-muted-foreground">
              {annualLineChart.years.map((year, idx) => {
                const YEAR_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
                return (
                  <span key={year} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: YEAR_PALETTE[idx % YEAR_PALETTE.length] }} />
                    {year}
                  </span>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-2">
            Cada ano tem uma cor distinta · linhas contínuas = Entradas · linhas tracejadas = Saídas.
          </p>
        </motion.div>
      )}

      {/* Saldo adaptativo: diário em um mês, mensal em períodos longos. */}
      {(monthlyBalanceData.length > 0 || (!sourcesUsed.onlyHistorico && projectionData.length > 0)) && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="glass-card rounded-xl p-3 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3 sm:mb-4">
            <h4 className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {monthlyBalanceData.length > 0 ? 'Evolução Mensal do Saldo' : 'Projeção de Saldo Diário'}
            </h4>
            {monthlyBalanceSummary && (
              <div className="flex gap-4 text-right">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Menor fechamento</p>
                  <p className={`text-xs sm:text-sm font-bold ${monthlyBalanceSummary.minimum.saldo < 0 ? 'text-destructive' : 'text-foreground'}`}>
                    {formatCurrency(monthlyBalanceSummary.minimum.saldo)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">{monthlyBalanceSummary.minimum.label}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Saldo final</p>
                  <p className={`text-xs sm:text-sm font-bold ${monthlyBalanceSummary.final.saldo < 0 ? 'text-destructive' : 'text-success'}`}>
                    {formatCurrency(monthlyBalanceSummary.final.saldo)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">{monthlyBalanceSummary.final.label}</p>
                </div>
              </div>
            )}
          </div>
          <ChartScroller width={undefined} height={dailyPresets.height}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyBalanceData.length > 0 ? monthlyBalanceData : projectionData} margin={dailyPresets.margin}>
                <defs>
                  <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey={monthlyBalanceData.length > 0 ? 'label' : 'data'} tick={{ fontSize: dailyPresets.tickFontSize }} interval={monthlyBalanceData.length > 0 ? 0 : dailyPresets.xInterval} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: dailyPresets.tickFontSize }} width={dailyPresets.isMobile ? 34 : 60} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                {monthlyBalanceData.length > 0 ? (
                  <Tooltip content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as typeof monthlyBalanceData[number] | undefined;
                    if (!active || !point) return null;
                    return (
                      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
                        <p className="font-semibold text-foreground mb-1">{point.fullLabel}</p>
                        <p className={point.saldo < 0 ? 'text-destructive' : 'text-success'}>Saldo: {formatCurrency(point.saldo)}</p>
                        {point.key !== 'initial' && (
                          <p className="text-muted-foreground">Variação: {point.variacao >= 0 ? '+' : ''}{formatCurrency(point.variacao)}</p>
                        )}
                      </div>
                    );
                  }} />
                ) : (
                  <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => `Data: ${label}`}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                )}
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  stroke="hsl(var(--success))"
                  fill="url(#saldoGrad)"
                  strokeWidth={2}
                  name="Saldo"
                  dot={monthlyBalanceData.length > 0 ? (props: any) => (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={props.payload.saldo < 0 ? 5 : 4}
                      fill={props.payload.saldo < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--success))'}
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                    />
                  ) : false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartScroller>

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

      {/* Observações do período (projeção) */}
      <ProjecaoNotas schoolId={schoolId} selectedMonth={selectedMonth} />
    </div>
  );
}
