import { useMemo, useState } from 'react';
import { getEntries, getSaldoInicial } from '@/lib/storage';
import { FinancialEntry } from '@/types/financial';
import { ScenarioType } from '@/components/ScenarioSelector';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { TrendingUp, TrendingDown, AlertTriangle, Plus, X } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

interface ScenarioViewProps {
  schoolId: string;
  scenario: ScenarioType;
  selectedMonth: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface SaleSimulation {
  id: string;
  quantidade: number;
  valorUnitario: number;
  meses: number;
}

export function ScenarioView({ schoolId, scenario, selectedMonth }: ScenarioViewProps) {
  const saldoInicial = useMemo(() => getSaldoInicial(schoolId), [schoolId]);
  const entries = useMemo(() => {
    const all = getEntries(schoolId);
    if (selectedMonth === 'all') return all;
    return all.filter(e => e.data.startsWith(selectedMonth));
  }, [schoolId, selectedMonth]);

  // Pessimist config
  const [reductionPct, setReductionPct] = useState(20);

  // Optimist config
  const [sales, setSales] = useState<SaleSimulation[]>([]);

  const addSale = () => setSales(s => [...s, { id: crypto.randomUUID(), quantidade: 1, valorUnitario: 1000, meses: 1 }]);
  const removeSale = (id: string) => setSales(s => s.filter(x => x.id !== id));
  const updateSale = (id: string, field: keyof Omit<SaleSimulation, 'id'>, value: number) => {
    setSales(s => s.map(x => x.id === id ? { ...x, [field]: value } : x));
  };

  // Build scenario data
  const scenarioData = useMemo(() => {
    const byDate: Record<string, { entradas: number; saidas: number }> = {};

    entries.forEach(e => {
      if (!byDate[e.data]) byDate[e.data] = { entradas: 0, saidas: 0 };
      if (e.tipo === 'entrada') byDate[e.data].entradas += e.valor;
      else byDate[e.data].saidas += e.valor;
    });

    // Apply scenario modifiers
    if (scenario === 'pessimista') {
      const factor = 1 - reductionPct / 100;
      Object.keys(byDate).forEach(d => { byDate[d].entradas *= factor; });
    }

    if (scenario === 'otimista') {
      // Distribute sales across months
      sales.forEach(sale => {
        const total = sale.quantidade * sale.valorUnitario;
        const monthly = total / sale.meses;
        const sortedDates = Object.keys(byDate).sort();
        if (sortedDates.length === 0) return;
        // Get unique months from entries
        const months = [...new Set(sortedDates.map(d => d.slice(0, 7)))].sort();
        for (let i = 0; i < sale.meses && i < months.length; i++) {
          // Add to first day of each month
          const dayKey = `${months[i]}-01`;
          if (!byDate[dayKey]) byDate[dayKey] = { entradas: 0, saidas: 0 };
          byDate[dayKey].entradas += monthly;
        }
        // If more months than available, extend
        if (sale.meses > months.length && months.length > 0) {
          const lastMonth = months[months.length - 1];
          const [ly, lm] = lastMonth.split('-').map(Number);
          for (let i = months.length; i < sale.meses; i++) {
            let nm = lm + (i - months.length + 1);
            let ny = ly;
            while (nm > 12) { nm -= 12; ny++; }
            const dayKey = `${ny}-${String(nm).padStart(2, '0')}-01`;
            if (!byDate[dayKey]) byDate[dayKey] = { entradas: 0, saidas: 0 };
            byDate[dayKey].entradas += monthly;
          }
        }
      });
    }

    const sorted = Object.keys(byDate).sort();
    let saldo = 0;
    return sorted.map(data => {
      const { entradas, saidas } = byDate[data];
      saldo += entradas - saidas;
      return { data: data.slice(5), fullDate: data, entradas, saidas, saldo };
    });
  }, [entries, scenario, reductionPct, sales]);

  const totalEntradas = scenarioData.reduce((s, d) => s + d.entradas, 0);
  const totalSaidas = scenarioData.reduce((s, d) => s + d.saidas, 0);
  const resultado = totalEntradas - totalSaidas;
  const negativeDays = scenarioData.filter(d => d.saldo < 0);
  const firstNeg = negativeDays[0];
  const firstRecovery = firstNeg ? scenarioData.find((d, i) => i > scenarioData.indexOf(firstNeg) && d.saldo >= 0) : null;

  const scenarioLabel = scenario === 'real' ? 'Real' : scenario === 'pessimista' ? 'Pessimista' : 'Otimista';
  const scenarioColor = scenario === 'real' ? 'hsl(174, 55%, 40%)' : scenario === 'pessimista' ? 'hsl(0, 72%, 50%)' : 'hsl(142, 60%, 45%)';
  const badgeClass = scenario === 'real' ? 'bg-primary/10 text-primary' : scenario === 'pessimista' ? 'bg-destructive/10 text-destructive' : 'bg-green-100 text-green-700';

  return (
    <div className="space-y-5">
      {/* Scenario badge */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${badgeClass}`}>
          Cenário: {scenarioLabel}
        </span>
        {scenario !== 'real' && (
          <span className="text-xs text-muted-foreground italic">Dados simulados — não afetam o fluxo real</span>
        )}
      </div>

      {/* Pessimist controls */}
      {scenario === 'pessimista' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-destructive/20">
          <h4 className="font-display font-semibold text-sm text-foreground mb-3">Configuração Pessimista</h4>
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">Redução nas receitas (%):</label>
            <Input
              type="number"
              min={0} max={100}
              value={reductionPct}
              onChange={e => setReductionPct(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              className="w-20 h-9 text-sm text-center"
            />
            <span className="text-xs text-destructive font-medium">-{reductionPct}% nas entradas</span>
          </div>
        </motion.div>
      )}

      {/* Optimist controls */}
      {scenario === 'otimista' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-display font-semibold text-sm text-foreground">Simulação de Vendas</h4>
            <button onClick={addSale} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
              <Plus className="w-3 h-3" /> Adicionar
            </button>
          </div>
          {sales.length === 0 && <p className="text-xs text-muted-foreground">Adicione vendas simuladas para ver o impacto no fluxo.</p>}
          <div className="space-y-2">
            {sales.map(s => (
              <div key={s.id} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Qtd vendas</label>
                    <Input type="number" min={1} value={s.quantidade} onChange={e => updateSale(s.id, 'quantidade', parseInt(e.target.value) || 1)} className="h-7 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Valor unitário</label>
                    <Input type="number" min={0} value={s.valorUnitario} onChange={e => updateSale(s.id, 'valorUnitario', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Meses (parcelas)</label>
                    <Input type="number" min={1} value={s.meses} onChange={e => updateSale(s.id, 'meses', parseInt(e.target.value) || 1)} className="h-7 text-xs" />
                  </div>
                </div>
                <div className="text-right min-w-[80px]">
                  <p className="text-[10px] text-muted-foreground">Total</p>
                  <p className="text-xs font-bold text-primary">{formatCurrency(s.quantidade * s.valorUnitario)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatCurrency(s.quantidade * s.valorUnitario / s.meses)}/mês</p>
                </div>
                <button onClick={() => removeSale(s.id)} className="p-1 rounded hover:bg-destructive/10"><X className="w-4 h-4 text-destructive" /></button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Receitas</span>
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <p className="text-2xl font-display font-bold text-primary">{formatCurrency(totalEntradas)}</p>
          {scenario !== 'real' && <span className={`text-[10px] font-semibold ${badgeClass} px-1.5 py-0.5 rounded mt-1 inline-block`}>Simulado</span>}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Despesas</span>
            <TrendingDown className="w-5 h-5 text-destructive" />
          </div>
          <p className="text-2xl font-display font-bold text-destructive">{formatCurrency(totalSaidas)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resultado</span>
          </div>
          <p className={`text-2xl font-display font-bold ${resultado >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(resultado)}</p>
          {scenario !== 'real' && <span className={`text-[10px] font-semibold ${badgeClass} px-1.5 py-0.5 rounded mt-1 inline-block`}>{scenarioLabel}</span>}
        </motion.div>
      </div>

      {/* Risk alert */}
      {negativeDays.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 border-destructive/30 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <h4 className="font-display font-semibold text-sm text-destructive">Risco de Caixa — {scenarioLabel}</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Saldo negativo em <span className="font-semibold text-foreground">{firstNeg.data}</span> ({formatCurrency(firstNeg.saldo)}).
                {firstRecovery && <> Recuperação em <span className="font-semibold text-foreground">{firstRecovery.data}</span>.</>}
                {!firstRecovery && <> Sem recuperação no período.</>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5"><span className="font-semibold">{negativeDays.length}</span> dia(s) com saldo negativo.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Chart */}
      {scenarioData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-6">
          <h3 className="text-base font-display font-semibold mb-4 text-foreground">
            Projeção de Saldo — {scenarioLabel}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={scenarioData}>
              <defs>
                <linearGradient id={`grad-${scenario}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={scenarioColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={scenarioColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 15%, 88%)" />
              <XAxis dataKey="data" tick={{ fontSize: 11, fill: 'hsl(210, 10%, 45%)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(210, 10%, 45%)' }} />
              <Tooltip
                contentStyle={{ background: 'hsl(0,0%,100%)', border: '1px solid hsl(210,15%,88%)', borderRadius: '8px', fontSize: '12px' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <ReferenceLine y={0} stroke="hsl(0, 72%, 50%)" strokeDasharray="4 4" strokeWidth={1.5} />
              <Legend />
              <Area type="monotone" dataKey="saldo" name={`Saldo (${scenarioLabel})`} stroke={scenarioColor} fill={`url(#grad-${scenario})`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  );
}
