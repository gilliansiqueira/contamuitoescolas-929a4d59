import { useMemo } from 'react';
import { useSchool, useEntriesFromBaseDate, useTypeClassifications } from '@/hooks/useFinancialData';
import { CashFlowDay, TypeClassification, FIXED_RESULT_TYPES } from '@/types/financial';
import { FinancialEntry } from '@/types/financial';
import { motion } from 'framer-motion';
import { matchesMonthFilter } from '@/components/MonthSelector';

interface CashFlowProps {
  schoolId: string;
  selectedMonth: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function isIgnored(entry: FinancialEntry, classifications: TypeClassification[]): boolean {
  if (entry.origem !== 'fluxo') return false;
  const tipoKey = entry.tipoOriginal || entry.tipo;
  if (FIXED_RESULT_TYPES.includes(tipoKey.toLowerCase())) return false;
  if (['entrada', 'saida'].includes(tipoKey.toLowerCase())) return false;
  const cls = classifications.find(c => c.tipoValor === tipoKey);
  return cls?.classificacao === 'ignorar';
}

function getEntryClassLabel(entry: FinancialEntry, classifications: TypeClassification[]): string {
  if (entry.origem !== 'fluxo') return 'Projetado';
  const tipoKey = entry.tipoOriginal || entry.tipo;
  if (FIXED_RESULT_TYPES.includes(tipoKey.toLowerCase()) || ['entrada', 'saida'].includes(tipoKey.toLowerCase())) return 'Resultado';
  const cls = classifications.find(c => c.tipoValor === tipoKey);
  if (cls?.entraNoResultado) return 'Resultado';
  return 'Operação';
}

export function CashFlow({ schoolId, selectedMonth }: CashFlowProps) {
  const { data: school } = useSchool(schoolId);
  const saldoInicial = school?.saldoInicial ?? 0;
  const baseDate = school?.saldoInicialData;
  const { data: allEntries = [] } = useEntriesFromBaseDate(schoolId, baseDate);
  const { data: classifications = [] } = useTypeClassifications(schoolId);

  // Filter out ignored entries
  const activeEntries = useMemo(() =>
    allEntries.filter(e => !isIgnored(e, classifications)),
    [allEntries, classifications]
  );

  const entries = useMemo(() =>
    activeEntries.filter(e => matchesMonthFilter(e.data, selectedMonth)),
    [activeEntries, selectedMonth]
  );

  const cashFlow: CashFlowDay[] = useMemo(() => {
    const byDate: Record<string, { entradas: number; saidas: number }> = {};
    entries.forEach(e => {
      if (!byDate[e.data]) byDate[e.data] = { entradas: 0, saidas: 0 };
      if (e.tipo === 'entrada') byDate[e.data].entradas += e.valor;
      else byDate[e.data].saidas += e.valor;
    });
    const sorted = Object.keys(byDate).sort();
    let saldo = saldoInicial;
    return sorted.map(data => {
      const saldoAnterior = saldo;
      const { entradas, saidas } = byDate[data];
      saldo += entradas - saidas;
      return { data, entradas, saidas, saldoAnterior, saldoDia: saldo };
    });
  }, [entries, saldoInicial]);

  const monthly = useMemo(() => {
    const byMonth: Record<string, { receitas: number; despesas: number; operacoes: number }> = {};
    entries.forEach(e => {
      const m = e.data.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { receitas: 0, despesas: 0, operacoes: 0 };
      const classLabel = getEntryClassLabel(e, classifications);
      if (classLabel === 'Operação') {
        byMonth[m].operacoes += e.valor;
      } else {
        if (e.tipo === 'entrada') byMonth[m].receitas += e.valor;
        else byMonth[m].despesas += e.valor;
      }
    });
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([mes, v]) => ({
      mes, ...v, resultado: v.receitas - v.despesas,
    }));
  }, [entries, classifications]);

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
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Operações</th>
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
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(m.operacoes)}</td>
                </tr>
              ))}
            </tbody>
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
          </table>
        </div>
      </motion.div>
    </div>
  );
}
