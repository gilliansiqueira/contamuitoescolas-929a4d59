import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinancialEntry, TypeClassification } from '@/types/financial';
import { useSchool, useEntriesFromBaseDate, useTypeClassifications, usePaymentDelayRules } from '@/hooks/useFinancialData';
import { Target, CalendarCheck, ArrowDown, ArrowUp, Wallet, AlertTriangle, Eye, EyeOff, Coins, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { matchesMonthFilter } from '@/components/MonthSelector';
import { addDaysAndAdjust } from '@/lib/dateUtils';
import { calculateTotals, filterActiveEntries, getSaldoImpact, getEffectiveClassification, classifyTipoName, getCanonicalKey, getCanonicalLabel } from '@/lib/classificationUtils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import { Receivables } from '@/components/Receivables';
import { Button } from '@/components/ui/button';
import { usePresentation } from '@/components/presentation-provider';
import { InsightsBar, type Insight } from '@/components/InsightsBar';
import { TrendingUp, TrendingDown, Sparkles, PiggyBank, Flame } from 'lucide-react';

interface DashboardProps {
  schoolId: string;
  selectedMonth: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalize(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, '_');
}

function applyDelays(entries: FinancialEntry[], rules: { formaCobranca: string; prazo: number }[]): FinancialEntry[] {
  return entries.map(e => {
    if (e.origem !== 'sponte' || e.tipo !== 'entrada') return e;
    const forma = e.categoria || '';
    const rule = rules.find(r => forma.toLowerCase().includes(r.formaCobranca.toLowerCase()));
    if (!rule || rule.prazo === 0) return e;
    return { ...e, data: addDaysAndAdjust(e.data, rule.prazo) };
  });
}

// Resolve the classification of a "tipo_valor" key (from upload or histórico).
// Uses synonym map (despesa/despesas/saida → despesa, receita/entrada → receita)
// before falling back to user-defined classifications.
function resolveTipoMeta(tipoKey: string, classifications: TypeClassification[]) {
  const key = normalize(tipoKey);
  const canonicalKey = getCanonicalKey(tipoKey);
  const synonymCls = classifyTipoName(tipoKey, classifications);
  // User config (only if not a fixed synonym)
  const userCls = classifications.find(c => normalize(c.tipoValor) === key);

  if (synonymCls === 'receita' || synonymCls === 'despesa') {
    return {
      classificacao: synonymCls,
      entraNoResultado: true,
      impactaCaixa: true,
      isEntrada: synonymCls === 'receita',
      label: getCanonicalLabel(tipoKey),
      canonicalKey,
    };
  }
  if (userCls) {
    return {
      classificacao: userCls.classificacao,
      entraNoResultado: userCls.entraNoResultado,
      impactaCaixa: userCls.impactaCaixa,
      isEntrada: userCls.classificacao === 'receita' || (userCls.classificacao === 'operacao' && /entrada|recebimento|aplicacao|aporte|resgate/.test(key)),
      label: userCls.label || tipoKey,
      canonicalKey,
    };
  }
  // Fallback for unknown tipos
  return {
    classificacao: 'operacao' as const,
    entraNoResultado: false,
    impactaCaixa: true,
    isEntrada: false,
    label: tipoKey,
    canonicalKey,
  };
}

export function Dashboard({ schoolId, selectedMonth }: DashboardProps) {
  const { isPresentationMode } = usePresentation();
  const { data: school } = useSchool(schoolId);
  const saldoInicial = school?.saldoInicial ?? 0;
  const baseDate = school?.saldoInicialData;
  const { data: rawEntries = [] } = useEntriesFromBaseDate(schoolId, baseDate);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const { data: delayRules = [] } = usePaymentDelayRules(schoolId);
  const [showInsights, setShowInsights] = useState(true);

  const allEntries = useMemo(() => applyDelays(rawEntries, delayRules), [rawEntries, delayRules]);
  const activeEntries = useMemo(() => filterActiveEntries(allEntries, classifications), [allEntries, classifications]);

  // ─── Histórico Financeiro (consolidado mensal) ───
  const { data: historicalRows = [] } = useQuery({
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

  // ─── Determina meses selecionados ───
  const selectedMonths = useMemo<string[]>(() => {
    if (selectedMonth === 'all') {
      const fromEntries = activeEntries.map(e => e.data.slice(0, 7));
      const fromHist = historicalRows.map(r => r.month);
      return Array.from(new Set([...fromEntries, ...fromHist])).sort();
    }
    return selectedMonth.split(',').map(m => m.trim()).filter(Boolean);
  }, [selectedMonth, activeEntries, historicalRows]);

  // ─── Classifica cada mês por fonte: upload > histórico > projeção ───
  const monthSources = useMemo(() => {
    const result: Record<string, 'upload' | 'historico' | 'projecao' | 'vazio'> = {};
    for (const m of selectedMonths) {
      const hasUpload = activeEntries.some(e => e.data.startsWith(m) && e.origem === 'fluxo');
      const hasHist = historicalRows.some(r => r.month === m);
      const hasOther = activeEntries.some(e => e.data.startsWith(m) && e.origem !== 'fluxo');
      if (hasUpload) result[m] = 'upload';
      else if (hasHist) result[m] = 'historico';
      else if (hasOther) result[m] = 'projecao';
      else result[m] = 'vazio';
    }
    return result;
  }, [selectedMonths, activeEntries, historicalRows]);

  // ─── KPIs DINÂMICOS por tipo (agregado de todas as fontes ativas no período) ───
  type TipoAgg = { key: string; label: string; valor: number; isEntrada: boolean; entraNoResultado: boolean; impactaCaixa: boolean; classificacao: string };
  const tipoAggregations = useMemo<TipoAgg[]>(() => {
    const map: Record<string, TipoAgg> = {};

    const ensure = (key: string): TipoAgg => {
      const k = normalize(key);
      if (!map[k]) {
        const meta = resolveTipoMeta(key, classifications);
        map[k] = { key: k, label: meta.label, valor: 0, isEntrada: meta.isEntrada, entraNoResultado: meta.entraNoResultado, impactaCaixa: meta.impactaCaixa, classificacao: meta.classificacao };
      }
      return map[k];
    };

    for (const m of selectedMonths) {
      const src = monthSources[m];
      if (src === 'historico') {
        // Usa histórico
        for (const r of historicalRows.filter(x => x.month === m)) {
          const agg = ensure(r.tipo_valor);
          agg.valor += Number(r.valor) || 0;
        }
      } else if (src === 'upload' || src === 'projecao') {
        // Usa lançamentos (upload tem prioridade implícita pois ambos estão em activeEntries; projeção só aparece se não há upload)
        const monthEntries = activeEntries.filter(e => e.data.startsWith(m));
        for (const e of monthEntries) {
          // Se é mês de upload, ignora lançamentos não-fluxo (prioridade do upload)
          if (src === 'upload' && e.origem !== 'fluxo') continue;
          const tipoKey = e.tipoOriginal || e.tipo;
          const agg = ensure(tipoKey);
          agg.valor += e.valor;
        }
      }
    }

    return Object.values(map)
      .filter(a => a.valor > 0 && a.classificacao !== 'ignorar')
      .sort((a, b) => {
        // Receitas primeiro, depois despesas, depois operações
        const order = { receita: 0, despesa: 1, operacao: 2, ignorar: 3 } as Record<string, number>;
        return (order[a.classificacao] ?? 9) - (order[b.classificacao] ?? 9) || b.valor - a.valor;
      });
  }, [selectedMonths, monthSources, historicalRows, activeEntries, classifications]);

  // ─── Totais agregados (Receitas, Despesas, Resultado) usando KPIs dinâmicos ───
  const totals = useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    let operacoesIn = 0;
    let operacoesOut = 0;
    for (const a of tipoAggregations) {
      if (a.classificacao === 'receita') receitas += a.valor;
      else if (a.classificacao === 'despesa') despesas += a.valor;
      else if (a.classificacao === 'operacao') {
        if (a.isEntrada) operacoesIn += a.valor;
        else operacoesOut += a.valor;
      }
    }
    return { receitas, despesas, resultado: receitas - despesas, operacoesIn, operacoesOut };
  }, [tipoAggregations]);

  // ─── Saldo inicial: acumula tudo antes do primeiro mês selecionado ───
  const saldoInicialCalculado = useMemo(() => {
    if (selectedMonth === 'all' || selectedMonths.length === 0) return saldoInicial;
    const monthStart = `${selectedMonths[0]}-01`;
    let saldo = saldoInicial;
    // Acumula lançamentos anteriores (apenas meses sem histórico)
    const histMonths = new Set(historicalRows.map(r => r.month));
    for (const e of activeEntries) {
      if (e.data >= monthStart) continue;
      const m = e.data.slice(0, 7);
      // Se mês tem upload, usa upload; se mês só tem histórico, ignora lançamentos não-fluxo
      const hasUpload = activeEntries.some(x => x.data.startsWith(m) && x.origem === 'fluxo');
      if (!hasUpload && histMonths.has(m)) continue;
      if (hasUpload && e.origem !== 'fluxo') continue;
      saldo += getSaldoImpact(e, classifications);
    }
    // Acumula histórico anterior (apenas meses sem upload)
    for (const r of historicalRows) {
      if (r.month >= selectedMonths[0]) continue;
      const hasUpload = activeEntries.some(x => x.data.startsWith(r.month) && x.origem === 'fluxo');
      if (hasUpload) continue;
      const meta = resolveTipoMeta(r.tipo_valor, classifications);
      if (!meta.impactaCaixa) continue;
      const v = Number(r.valor) || 0;
      saldo += meta.isEntrada ? v : -v;
    }
    return saldo;
  }, [activeEntries, classifications, saldoInicial, selectedMonth, selectedMonths, historicalRows]);

  const saldoFinal = useMemo(() => {
    let saldo = saldoInicialCalculado;
    for (const a of tipoAggregations) {
      if (!a.impactaCaixa) continue;
      saldo += a.isEntrada ? a.valor : -a.valor;
    }
    return saldo;
  }, [saldoInicialCalculado, tipoAggregations]);

  // ─── Bandeiras para condicionar UI ───
  const sourcesUsed = useMemo(() => {
    const set = new Set(Object.values(monthSources));
    return {
      hasUpload: set.has('upload'),
      hasHistorico: set.has('historico'),
      hasProjecao: set.has('projecao'),
      onlyHistorico: set.has('historico') && !set.has('upload') && !set.has('projecao'),
    };
  }, [monthSources]);

  const hasRealizado = sourcesUsed.hasUpload || sourcesUsed.hasHistorico;

  // ─── Realizado vs Projetado (apenas para meses de upload/projeção, não histórico) ───
  const entriesForRealVsProj = useMemo(() => {
    return activeEntries.filter(e => {
      const m = e.data.slice(0, 7);
      const src = monthSources[m];
      if (!src) return false;
      if (src === 'historico') return false;
      if (src === 'upload') return e.origem === 'fluxo';
      return true;
    });
  }, [activeEntries, monthSources]);

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
      if (src === 'historico') continue;
      if (src === 'upload' && e.origem !== 'fluxo') continue;
      // Mês atual fora do filtro: pula
      if (!selectedMonths.includes(m) && selectedMonth !== 'all') continue;
      saldoToday += getSaldoImpact(e, classifications);
    }

    const byDate: Record<string, { entradas: number; saidas: number }> = {};
    for (const e of futureEntries) {
      if (!byDate[e.data]) byDate[e.data] = { entradas: 0, saidas: 0 };
      const cls = getEffectiveClassification(e, classifications);
      if (cls === 'ignorar') continue;
      if (e.tipo === 'entrada') byDate[e.data].entradas += e.valor;
      else byDate[e.data].saidas += e.valor;
    }

    const sorted = Object.keys(byDate).sort();
    let saldo = saldoToday;
    return sorted.map(data => {
      const d = byDate[data];
      saldo += d.entradas - d.saidas;
      return { data: data.slice(5).split('-').reverse().join('/'), fullDate: data, entradas: d.entradas, saidas: d.saidas, saldo };
    });
  }, [activeEntries, classifications, saldoInicialCalculado, monthSources, sourcesUsed.onlyHistorico, historicalRows, selectedMonths, selectedMonth, tipoAggregations]);

  // ─── Gráfico de barras mensal: Receitas vs Despesas (combina upload + histórico) ───
  const monthlyChart = useMemo(() => {
    const map: Record<string, { entradas: number; saidas: number }> = {};
    for (const m of selectedMonths) {
      const src = monthSources[m];
      if (!map[m]) map[m] = { entradas: 0, saidas: 0 };
      if (src === 'historico') {
        for (const r of historicalRows.filter(x => x.month === m)) {
          const meta = resolveTipoMeta(r.tipo_valor, classifications);
          if (!meta.entraNoResultado) continue;
          const v = Number(r.valor) || 0;
          if (meta.classificacao === 'receita') map[m].entradas += v;
          else if (meta.classificacao === 'despesa') map[m].saidas += v;
        }
      } else if (src === 'upload' || src === 'projecao') {
        for (const e of activeEntries.filter(x => x.data.startsWith(m))) {
          if (src === 'upload' && e.origem !== 'fluxo') continue;
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
  }, [selectedMonths, monthSources, historicalRows, activeEntries, classifications]);

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
      if (src === 'historico' || src === 'vazio') continue;
      for (const e of activeEntries.filter(x => x.data.startsWith(m))) {
        if (src === 'upload' && e.origem !== 'fluxo') continue;
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
      {tipoAggregations.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" /> Por Tipo Financeiro
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tipoAggregations.map((a, i) => {
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
