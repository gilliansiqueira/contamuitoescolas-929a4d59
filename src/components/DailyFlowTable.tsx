import { useMemo } from 'react';
import { FinancialEntry } from '@/types/financial';
import { useSchool, useEntriesFromBaseDate, usePaymentDelayRules } from '@/hooks/useFinancialData';
import { matchesMonthFilter } from '@/components/MonthSelector';
import { getAllDaysInMonths, isWeekend, getDayOfWeek, formatDateBR, addDaysAndAdjust } from '@/lib/dateUtils';
import { motion } from 'framer-motion';
import { Table2 } from 'lucide-react';

interface DailyFlowTableProps {
  schoolId: string;
  selectedMonth: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface DayRow {
  data: string;
  entradaPrevista: number;
  entradaRealizada: number;
  saidaPrevista: number;
  saidaRealizada: number;
  saldoFinal: number;
  isWeekend: boolean;
  dayOfWeek: string;
}

function applyPaymentDelays(entries: FinancialEntry[], rules: { formaCobranca: string; prazo: number }[]): FinancialEntry[] {
  return entries.map(e => {
    if (e.origem !== 'sponte' || e.tipo !== 'entrada') return e;
    const forma = e.categoria || '';
    const rule = rules.find(r => forma.toLowerCase().includes(r.formaCobranca.toLowerCase()));
    if (!rule || rule.prazo === 0) return e;
    const newDate = addDaysAndAdjust(e.data, rule.prazo);
    return { ...e, data: newDate };
  });
}

export function DailyFlowTable({ schoolId, selectedMonth }: DailyFlowTableProps) {
  const { data: school } = useSchool(schoolId);
  const saldoInicial = school?.saldoInicial ?? 0;
  const baseDate = school?.saldoInicialData;
  const { data: allEntries = [] } = useEntriesFromBaseDate(schoolId, baseDate);
  const { data: delayRules = [] } = usePaymentDelayRules(schoolId);

  const adjustedEntries = useMemo(() => applyPaymentDelays(allEntries, delayRules), [allEntries, delayRules]);

  const months = useMemo(() => {
    if (selectedMonth === 'all') {
      const set = new Set<string>();
      adjustedEntries.forEach(e => set.add(e.data.slice(0, 7)));
      return Array.from(set).sort();
    }
    return selectedMonth.split(',').filter(Boolean).sort();
  }, [selectedMonth, adjustedEntries]);

  const allDays = useMemo(() => getAllDaysInMonths(months), [months]);

  const dailyData = useMemo(() => {
    const firstDay = allDays[0];
    let priorSaldo = saldoInicial;
    if (firstDay) {
      adjustedEntries.filter(e => e.data < firstDay).forEach(e => {
        if (e.tipo === 'entrada') priorSaldo += e.valor;
        else priorSaldo -= e.valor;
      });
    }

    const byDate: Record<string, { entradaPrevista: number; entradaRealizada: number; saidaPrevista: number; saidaRealizada: number }> = {};
    adjustedEntries.forEach(e => {
      if (!allDays.includes(e.data)) return;
      if (!byDate[e.data]) byDate[e.data] = { entradaPrevista: 0, entradaRealizada: 0, saidaPrevista: 0, saidaRealizada: 0 };
      const isRealizado = e.origem === 'fluxo';
      if (e.tipo === 'entrada') {
        if (isRealizado) byDate[e.data].entradaRealizada += e.valor;
        else byDate[e.data].entradaPrevista += e.valor;
      } else {
        if (isRealizado) byDate[e.data].saidaRealizada += e.valor;
        else byDate[e.data].saidaPrevista += e.valor;
      }
    });

    let saldo = priorSaldo;
    return allDays.map(data => {
      const d = byDate[data] || { entradaPrevista: 0, entradaRealizada: 0, saidaPrevista: 0, saidaRealizada: 0 };
      saldo += (d.entradaPrevista + d.entradaRealizada) - (d.saidaPrevista + d.saidaRealizada);
      return {
        data,
        ...d,
        saldoFinal: saldo,
        isWeekend: isWeekend(data),
        dayOfWeek: getDayOfWeek(data),
      } as DayRow;
    });
  }, [allDays, adjustedEntries, saldoInicial]);

  const saldoFinalPeriodo = dailyData.length > 0 ? dailyData[dailyData.length - 1].saldoFinal : saldoInicial;

  if (allDays.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
        Selecione um período para visualizar o fluxo diário.
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="glass-card rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Table2 className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-foreground">Saldo Final do Período</span>
        </div>
        <span className={`text-lg font-display font-bold ${saldoFinalPeriodo >= 0 ? 'text-primary' : 'text-destructive'}`}>
          {formatCurrency(saldoFinalPeriodo)}
        </span>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-display font-semibold text-foreground text-sm">Fluxo Diário Completo</h3>
          <p className="text-xs text-muted-foreground mt-1">{allDays.length} dia(s) no período</p>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="bg-surface">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Dia</th>
                <th className="px-3 py-2.5 text-right font-medium text-blue-600">Entrada Prevista</th>
                <th className="px-3 py-2.5 text-right font-medium text-primary">Entrada Realizada</th>
                <th className="px-3 py-2.5 text-right font-medium text-orange-500">Saída Prevista</th>
                <th className="px-3 py-2.5 text-right font-medium text-destructive">Saída Realizada</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Saldo Final</th>
              </tr>
            </thead>
            <tbody>
              {dailyData.map(day => {
                const hasMovement = day.entradaPrevista > 0 || day.entradaRealizada > 0 || day.saidaPrevista > 0 || day.saidaRealizada > 0;
                return (
                  <tr
                    key={day.data}
                    className={`border-t border-border/30 ${
                      day.isWeekend ? 'bg-muted/30' : ''
                    } ${day.saldoFinal < 0 ? 'bg-destructive/5' : ''} ${
                      !hasMovement && !day.isWeekend ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-foreground">{formatDateBR(day.data)}</td>
                    <td className={`px-3 py-2 ${day.isWeekend ? 'text-muted-foreground font-semibold' : 'text-muted-foreground'}`}>
                      {day.dayOfWeek}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-600">
                      {day.entradaPrevista > 0 ? formatCurrency(day.entradaPrevista) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-primary">
                      {day.entradaRealizada > 0 ? formatCurrency(day.entradaRealizada) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-orange-500">
                      {day.saidaPrevista > 0 ? formatCurrency(day.saidaPrevista) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-destructive">
                      {day.saidaRealizada > 0 ? formatCurrency(day.saidaRealizada) : '-'}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${day.saldoFinal >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatCurrency(day.saldoFinal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
