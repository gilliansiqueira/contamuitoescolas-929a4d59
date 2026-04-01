import { useMemo } from 'react';
import { FinancialEntry } from '@/types/financial';
import { useSchool, useEntriesFromBaseDate, useTypeClassifications, usePaymentDelayRules } from '@/hooks/useFinancialData';
import { Target, CalendarCheck, ArrowDown, ArrowUp, Wallet, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { matchesMonthFilter } from '@/components/MonthSelector';
import { addDaysAndAdjust } from '@/lib/dateUtils';
import { calculateTotals, filterActiveEntries, getSaldoImpact, isReceita, isDespesa, getEffectiveClassification } from '@/lib/classificationUtils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';

interface DashboardProps {
  schoolId: string;
  selectedMonth: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

export function Dashboard({ schoolId, selectedMonth }: DashboardProps) {
  const { data: school } = useSchool(schoolId);
  const saldoInicial = school?.saldoInicial ?? 0;
  const baseDate = school?.saldoInicialData;
  const { data: rawEntries = [] } = useEntriesFromBaseDate(schoolId, baseDate);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const { data: delayRules = [] } = usePaymentDelayRules(schoolId);

  const allEntries = useMemo(() => applyDelays(rawEntries, delayRules), [rawEntries, delayRules]);
  const activeEntries = useMemo(() => filterActiveEntries(allEntries, classifications), [allEntries, classifications]);

  const entries = useMemo(() =>
    activeEntries.filter(e => matchesMonthFilter(e.data, selectedMonth)),
    [activeEntries, selectedMonth]
  );

  // Totals using proper classification
  const totals = useMemo(() => calculateTotals(entries, classifications), [entries, classifications]);

  // Saldo final = saldoInicial + all saldo impacts in period
  const saldoFinal = useMemo(() => {
    let saldo = saldoInicial;
    for (const e of entries) {
      saldo += getSaldoImpact(e, classifications);
    }
    return saldo;
  }, [entries, classifications, saldoInicial]);

  // Breakdown by tipo_registro using proper classification
  const realizadoTotals = useMemo(() =>
    calculateTotals(entries.filter(e => e.tipoRegistro === 'realizado'), classifications),
    [entries, classifications]
  );
  const projetadoTotals = useMemo(() =>
    calculateTotals(entries.filter(e => e.tipoRegistro === 'projetado'), classifications),
    [entries, classifications]
  );

  // Projection chart data (daily saldo for future entries)
  const projectionData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const futureEntries = activeEntries.filter(e => e.data >= today);
    if (futureEntries.length === 0) return [];

    // Calculate saldo up to today
    let saldoToday = saldoInicial;
    for (const e of activeEntries.filter(e => e.data < today)) {
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
      return {
        data: data.slice(5).split('-').reverse().join('/'),
        fullDate: data,
        entradas: d.entradas,
        saidas: d.saidas,
        saldo,
      };
    });
  }, [activeEntries, classifications, saldoInicial]);

  // Cash alerts
  const negativeDays = useMemo(() =>
    projectionData.filter(d => d.saldo < 0),
    [projectionData]
  );

  const firstNegativeDay = negativeDays.length > 0 ? negativeDays[0] : null;

  return (
    <div className="space-y-6">
      {/* Cash Alerts */}
      {firstNegativeDay && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              ⚠️ Atenção: saldo ficará negativo em {firstNegativeDay.fullDate.split('-').reverse().join('/')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Saldo projetado: {formatCurrency(firstNegativeDay.saldo)}
              {negativeDays.length > 1 && ` — ${negativeDays.length} dias com saldo negativo no período`}
            </p>
          </div>
        </motion.div>
      )}

      {/* Main KPIs */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" /> Resultado do Período
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo Inicial</span>
            </div>
            <p className="text-2xl font-display font-bold text-foreground">{formatCurrency(saldoInicial)}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUp className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Receitas</span>
            </div>
            <p className="text-2xl font-display font-bold text-primary">{formatCurrency(totals.receitas)}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDown className="w-4 h-4 text-destructive" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Despesas</span>
            </div>
            <p className="text-2xl font-display font-bold text-destructive">{formatCurrency(totals.despesas)}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resultado</span>
            </div>
            <p className={`text-2xl font-display font-bold ${totals.resultado >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(totals.resultado)}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <CalendarCheck className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo Final</span>
            </div>
            <p className={`text-2xl font-display font-bold ${saldoFinal >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(saldoFinal)}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Operações info */}
      {(totals.operacoesIn > 0 || totals.operacoesOut > 0) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="glass-card rounded-xl p-4">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">💼 Operações (não entram no resultado)</h4>
          <div className="flex gap-6 text-sm">
            <span className="text-primary">Entradas: {formatCurrency(totals.operacoesIn)}</span>
            <span className="text-destructive">Saídas: {formatCurrency(totals.operacoesOut)}</span>
            <span className="text-muted-foreground">Líquido: {formatCurrency(totals.operacoesIn - totals.operacoesOut)}</span>
          </div>
        </motion.div>
      )}

      {/* Realizado vs Projetado breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5">
          <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">✔ Realizado</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase">Receitas</span>
              <p className="text-lg font-display font-bold text-primary">{formatCurrency(realizadoTotals.receitas)}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase">Despesas</span>
              <p className="text-lg font-display font-bold text-destructive">{formatCurrency(realizadoTotals.despesas)}</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border/30">
            <span className="text-[10px] text-muted-foreground uppercase">Resultado Realizado</span>
            <p className={`text-lg font-display font-bold ${realizadoTotals.resultado >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(realizadoTotals.resultado)}
            </p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card rounded-xl p-5">
          <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-3">📊 Projetado</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase">Receitas</span>
              <p className="text-lg font-display font-bold text-primary">{formatCurrency(projetadoTotals.receitas)}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase">Despesas</span>
              <p className="text-lg font-display font-bold text-destructive">{formatCurrency(projetadoTotals.despesas)}</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border/30">
            <span className="text-[10px] text-muted-foreground uppercase">Resultado Projetado</span>
            <p className={`text-lg font-display font-bold ${projetadoTotals.resultado >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(projetadoTotals.resultado)}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Projection Chart */}
      {projectionData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass-card rounded-xl p-5">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">📈 Projeção de Saldo</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projectionData}>
                <defs>
                  <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="data" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Data: ${label}`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  stroke="hsl(var(--primary))"
                  fill="url(#saldoGrad)"
                  strokeWidth={2}
                  name="Saldo"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
    </div>
  );
}
