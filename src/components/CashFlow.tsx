import { useMemo } from 'react';
import { getEntries } from '@/lib/storage';
import { CashFlowDay } from '@/types/financial';
import { motion } from 'framer-motion';

interface CashFlowProps {
  schoolId: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CashFlow({ schoolId }: CashFlowProps) {
  const entries = useMemo(() => getEntries(schoolId), [schoolId]);

  const cashFlow: CashFlowDay[] = useMemo(() => {
    const byDate: Record<string, { entradas: number; saidas: number }> = {};
    entries.forEach(e => {
      if (!byDate[e.data]) byDate[e.data] = { entradas: 0, saidas: 0 };
      if (e.tipo === 'entrada') byDate[e.data].entradas += e.valor;
      else byDate[e.data].saidas += e.valor;
    });
    const sorted = Object.keys(byDate).sort();
    let saldo = 0;
    return sorted.map(data => {
      const saldoAnterior = saldo;
      const { entradas, saidas } = byDate[data];
      saldo += entradas - saidas;
      return { data, entradas, saidas, saldoAnterior, saldoDia: saldo };
    });
  }, [entries]);

  // Monthly consolidation
  const monthly = useMemo(() => {
    const byMonth: Record<string, { receitas: number; despesas: number }> = {};
    entries.forEach(e => {
      const m = e.data.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { receitas: 0, despesas: 0 };
      if (e.tipo === 'entrada') byMonth[m].receitas += e.valor;
      else byMonth[m].despesas += e.valor;
    });
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([mes, v]) => ({
      mes, ...v, resultado: v.receitas - v.despesas,
    }));
  }, [entries]);

  if (cashFlow.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
        Nenhum dado disponível. Importe arquivos para gerar o fluxo de caixa.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Monthly consolidation */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-display font-semibold">Consolidação Mensal</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mês</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Receitas</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Despesas</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map(m => (
                <tr key={m.mes} className="border-t border-border/30">
                  <td className="px-4 py-3 font-medium">{m.mes}</td>
                  <td className="px-4 py-3 text-right text-primary">{formatCurrency(m.receitas)}</td>
                  <td className="px-4 py-3 text-right text-destructive">{formatCurrency(m.despesas)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${m.resultado >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {formatCurrency(m.resultado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Daily cash flow */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-display font-semibold">Fluxo de Caixa Diário</h3>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Entradas</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saídas</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saldo Anterior</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {cashFlow.map(day => (
                <tr key={day.data} className="border-t border-border/30">
                  <td className="px-4 py-2 font-medium text-xs">{day.data}</td>
                  <td className="px-4 py-2 text-right text-primary text-xs">{formatCurrency(day.entradas)}</td>
                  <td className="px-4 py-2 text-right text-destructive text-xs">{formatCurrency(day.saidas)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground text-xs">{formatCurrency(day.saldoAnterior)}</td>
                  <td className={`px-4 py-2 text-right font-semibold text-xs ${day.saldoDia >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {formatCurrency(day.saldoDia)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
