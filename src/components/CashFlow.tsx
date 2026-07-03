import { useMemo } from 'react';
import { useTypeClassifications } from '@/hooks/useFinancialData';
import { useProjectedEntries } from '@/hooks/useProjectedEntries';
import { usePeriodMovementCtx } from '@/hooks/usePeriodMovementCtx';
import { CashFlowDay } from '@/types/financial';
import { motion } from 'framer-motion';
import { matchesMonthFilter } from '@/components/MonthSelector';
import {
  buildMonthMovement,
  computeSaldoInicial,
  includeEntryForMonth,
  resolveMonthSource,
} from '@/lib/periodMovement';

interface CashFlowProps {
  schoolId: string;
  selectedMonth: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CashFlow({ schoolId, selectedMonth }: CashFlowProps) {
  const { entries: projectedEntries } = useProjectedEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const { ctx: movementCtx, isInModel } = usePeriodMovementCtx(schoolId);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Filtra entries que participam do fluxo diário conforme a fonte oficial do mês.
  const activeEntries = useMemo(
    () => projectedEntries.filter(e => {
      if (e.impacto === 0) return false;
      const src = resolveMonthSource(e.dataProjetada.slice(0, 7), movementCtx);
      return includeEntryForMonth(e, src, todayStr, classifications);
    }),
    [projectedEntries, movementCtx, todayStr, classifications]
  );

  const entries = useMemo(() =>
    activeEntries.filter(e => matchesMonthFilter(e.dataProjetada, selectedMonth)),
    [activeEntries, selectedMonth]
  );

  // Meses selecionados, ordenados.
  const months = useMemo(() => {
    if (selectedMonth === 'all') {
      const set = new Set<string>();
      entries.forEach(e => set.add(e.dataProjetada.slice(0, 7)));
      return Array.from(set).sort();
    }
    return selectedMonth.split(',').filter(Boolean).sort();
  }, [selectedMonth, entries]);

  // Saldo inicial oficial via SSOT (saldo final do mês anterior ao primeiro selecionado).
  const saldoInicialPeriodo = useMemo(() => {
    if (months.length === 0) return movementCtx.saldoInicialBase;
    return computeSaldoInicial(months[0], movementCtx, { isInModel });
  }, [months, movementCtx, isInModel]);

  // Fluxo diário — parte do saldo inicial oficial e acumula impacto dia a dia.
  const cashFlow: CashFlowDay[] = useMemo(() => {
    const byDate: Record<string, { entradas: number; saidas: number }> = {};
    entries.forEach(e => {
      const data = e.dataProjetada;
      if (!byDate[data]) byDate[data] = { entradas: 0, saidas: 0 };
      const impact = e.impacto;
      if (impact > 0) byDate[data].entradas += impact;
      else if (impact < 0) byDate[data].saidas += Math.abs(impact);
    });
    const sorted = Object.keys(byDate).sort();
    let saldo = saldoInicialPeriodo;
    return sorted.map(data => {
      const saldoAnterior = saldo;
      const { entradas, saidas } = byDate[data];
      saldo += entradas - saidas;
      return { data, entradas, saidas, saldoAnterior, saldoDia: saldo };
    });
  }, [entries, saldoInicialPeriodo]);

  // Consolidação mensal — vem direto da SSOT (buildMonthMovement).
  const monthly = useMemo(() => {
    return months.map(m => {
      const mv = buildMonthMovement(m, movementCtx, { isInModel });
      return { mes: m, receitas: mv.receitas, despesas: mv.despesas, resultado: mv.receitas - mv.despesas };
    }).filter(m => m.receitas > 0 || m.despesas > 0);
  }, [months, movementCtx, isInModel]);
  const monthlyTotals = useMemo(() => monthly.reduce((a, m) => ({
    receitas: a.receitas + m.receitas, despesas: a.despesas + m.despesas, resultado: a.resultado + m.resultado,
  }), { receitas: 0, despesas: 0, resultado: 0 }), [monthly]);

  const dailyTotals = useMemo(() => cashFlow.reduce((a, d) => ({
    entradas: a.entradas + d.entradas, saidas: a.saidas + d.saidas,
  }), { entradas: 0, saidas: 0 }), [cashFlow]);





  if (cashFlow.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
        Nenhum dado disponível. Importe arquivos para gerar o fluxo de caixa.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-display font-semibold text-foreground">Consolidação Mensal</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mês</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Receitas</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Despesas</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map(m => (
                <tr key={m.mes} className="border-t border-border/30">
                  <td className="px-4 py-3 font-medium text-foreground">{m.mes}</td>
                  <td className="px-4 py-3 text-right text-primary">{formatCurrency(m.receitas)}</td>
                  <td className="px-4 py-3 text-right text-destructive">{formatCurrency(m.despesas)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${m.resultado >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {formatCurrency(m.resultado)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                <td className="px-4 py-3 text-foreground">TOTAIS</td>
                <td className="px-4 py-3 text-right text-primary">{formatCurrency(monthlyTotals.receitas)}</td>
                <td className="px-4 py-3 text-right text-destructive">{formatCurrency(monthlyTotals.despesas)}</td>
                <td className={`px-4 py-3 text-right ${monthlyTotals.resultado >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(monthlyTotals.resultado)}</td>
              </tr>
            </tfoot>
          </table>

        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-display font-semibold text-foreground">Fluxo de Caixa Diário</h3>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="bg-surface">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Entradas</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saídas</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saldo Anterior</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {cashFlow.map(day => (
                <tr key={day.data} className={`border-t border-border/30 ${day.saldoDia < 0 ? 'negative-row' : ''}`}>
                  <td className="px-4 py-2 font-medium text-xs text-foreground">{day.data}</td>
                  <td className="px-4 py-2 text-right text-primary text-xs">{formatCurrency(day.entradas)}</td>
                  <td className="px-4 py-2 text-right text-destructive text-xs">{formatCurrency(day.saidas)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground text-xs">{formatCurrency(day.saldoAnterior)}</td>
                  <td className={`px-4 py-2 text-right font-semibold text-xs ${day.saldoDia >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {formatCurrency(day.saldoDia)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-card">
              <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                <td className="px-4 py-2 text-foreground text-xs">TOTAIS</td>
                <td className="px-4 py-2 text-right text-primary text-xs">{formatCurrency(dailyTotals.entradas)}</td>
                <td className="px-4 py-2 text-right text-destructive text-xs">{formatCurrency(dailyTotals.saidas)}</td>
                <td className="px-4 py-2 text-right text-muted-foreground text-xs">—</td>
                <td className="px-4 py-2 text-right text-xs">—</td>
              </tr>
            </tfoot>
          </table>

        </div>
      </motion.div>
    </div>
  );
}
