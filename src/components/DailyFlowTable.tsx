import { useMemo } from 'react';
import { useProjectedEntries } from '@/hooks/useProjectedEntries';
import { useSaldoInicialPeriodo } from '@/hooks/useSaldoInicialPeriodo';
import { useEntries, useTypeClassifications } from '@/hooks/useFinancialData';
import { getSaldoImpact } from '@/lib/classificationUtils';
import { resolveEntryLedgerRule } from '@/lib/ledgerEngine';
import { getAllDaysInMonths, isWeekend, getDayOfWeek, formatDateBR } from '@/lib/dateUtils';
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
  saldoFinalPrevisto: number;
  saldoFinalRealizado: number;
  entradaPrevista: number;
  entradaRealizada: number;
  saidaPrevista: number;
  saidaRealizada: number;
  operacoes: number;
  saldoFinal: number;
  isWeekend: boolean;
  dayOfWeek: string;
}

export function DailyFlowTable({ schoolId, selectedMonth }: DailyFlowTableProps) {
  // Previsto segue a projeção (Sponte, Cheques, Cartões, Contas a Pagar etc.).
  // Realizado NÃO usa projeção: vem diretamente do upload Fluxo de Caixa,
  // com a data original do acontecido no dia a dia — mesma fonte do Dashboard Realizado.
  const { entries: projectedEntries } = useProjectedEntries(schoolId);
  const { data: rawEntries = [] } = useEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);

  const adjustedProjectedEntries = useMemo(
    () => projectedEntries.filter(e => e.origem !== 'fluxo' && e.impacto !== 0),
    [projectedEntries]
  );

  const realizedEntries = useMemo(
    () => rawEntries
      .filter(e => e.origem === 'fluxo')
      .map(e => ({ ...e, dataProjetada: e.data, impacto: getSaldoImpact(e, classifications) }))
      .filter(e => e.impacto !== 0),
    [rawEntries, classifications]
  );

  const months = useMemo(() => {
    if (selectedMonth === 'all') {
      const set = new Set<string>();
      adjustedProjectedEntries.forEach(e => set.add(e.dataProjetada.slice(0, 7)));
      realizedEntries.forEach(e => set.add(e.data.slice(0, 7)));
      return Array.from(set).sort();
    }
    return selectedMonth.split(',').filter(Boolean).sort();
  }, [selectedMonth, adjustedProjectedEntries, realizedEntries]);

  const allDays = useMemo(() => getAllDaysInMonths(months), [months]);

  // Saldo Inicial do período — mesma SSOT do Dashboard.
  const saldoInicialPeriodo = useSaldoInicialPeriodo(schoolId, months);

  const dailyData = useMemo(() => {
    const priorSaldo = saldoInicialPeriodo;

    const byDate: Record<string, { entradaPrevista: number; entradaRealizada: number; saidaPrevista: number; saidaRealizada: number; operacoes: number }> = {};
    adjustedProjectedEntries.forEach(e => {
      const data = e.dataProjetada;
      if (!allDays.includes(data)) return;
      if (!byDate[data]) byDate[data] = { entradaPrevista: 0, entradaRealizada: 0, saidaPrevista: 0, saidaRealizada: 0, operacoes: 0 };
      const impact = e.impacto;
      if (impact === 0) return;
      // Operação (entraNoResultado=false) impacta caixa mas vai para coluna Operações
      if (!resolveEntryLedgerRule(e, classifications).entraNoResultado) {
        byDate[data].operacoes += impact;
        return;
      }
      if (impact > 0) {
        byDate[data].entradaPrevista += impact;
      } else {
        byDate[data].saidaPrevista += Math.abs(impact);
      }
    });

    realizedEntries.forEach(e => {
      const data = e.data;
      if (!allDays.includes(data)) return;
      if (!byDate[data]) byDate[data] = { entradaPrevista: 0, entradaRealizada: 0, saidaPrevista: 0, saidaRealizada: 0, operacoes: 0 };
      const impact = e.impacto;
      if (impact === 0) return;
      if (!resolveEntryLedgerRule(e, classifications).entraNoResultado) {
        byDate[data].operacoes += impact;
        return;
      }
      if (impact > 0) {
        byDate[data].entradaRealizada += impact;
      } else {
        byDate[data].saidaRealizada += Math.abs(impact);
      }
    });


    let saldo = priorSaldo;
    let saldoPrev = priorSaldo;
    let saldoReal = priorSaldo;
    return allDays.map(data => {
      const d = byDate[data] || { entradaPrevista: 0, entradaRealizada: 0, saidaPrevista: 0, saidaRealizada: 0, operacoes: 0 };
      saldo += (d.entradaPrevista + d.entradaRealizada) - (d.saidaPrevista + d.saidaRealizada) + d.operacoes;
      saldoPrev += d.entradaPrevista - d.saidaPrevista;
      saldoReal += d.entradaRealizada - d.saidaRealizada - d.operacoes;
      return {
        data,
        ...d,
        saldoFinal: saldo,
        saldoFinalPrevisto: saldoPrev,
        saldoFinalRealizado: saldoReal,
        isWeekend: isWeekend(data),
        dayOfWeek: getDayOfWeek(data),
      } as DayRow;
    });
  }, [allDays, adjustedProjectedEntries, realizedEntries, saldoInicialPeriodo, classifications]);

  const saldoFinalPeriodo = dailyData.length > 0 ? dailyData[dailyData.length - 1].saldoFinal : saldoInicialPeriodo;

  const totals = useMemo(() => dailyData.reduce((acc, d) => ({
    entradaPrevista: acc.entradaPrevista + d.entradaPrevista,
    entradaRealizada: acc.entradaRealizada + d.entradaRealizada,
    saidaPrevista: acc.saidaPrevista + d.saidaPrevista,
    saidaRealizada: acc.saidaRealizada + d.saidaRealizada,
    operacoes: acc.operacoes + d.operacoes,
  }), { entradaPrevista: 0, entradaRealizada: 0, saidaPrevista: 0, saidaRealizada: 0, operacoes: 0 }), [dailyData]);

  if (allDays.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
        Selecione um período para visualizar o fluxo diário.
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table2 className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Saldo Inicial do Período</span>
          </div>
          <span className={`text-lg font-display font-bold ${saldoInicialPeriodo >= 0 ? 'text-foreground' : 'text-destructive'}`}>
            {formatCurrency(saldoInicialPeriodo)}
          </span>
        </div>
        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table2 className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">Saldo Final do Período</span>
          </div>
          <span className={`text-lg font-display font-bold ${saldoFinalPeriodo >= 0 ? 'text-primary' : 'text-destructive'}`}>
            {formatCurrency(saldoFinalPeriodo)}
          </span>
        </div>
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
                <th className="px-3 py-2.5 text-right font-medium text-purple-600">Operações</th>
                <th className="px-3 py-2.5 text-right font-medium text-blue-700">Saldo Final Previsto</th>
                <th className="px-3 py-2.5 text-right font-medium text-primary">Saldo Final Realizado</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Saldo Final</th>
              </tr>
            </thead>
            <tbody>
              {dailyData.map(day => {
                const hasMovement = day.entradaPrevista > 0 || day.entradaRealizada > 0 || day.saidaPrevista > 0 || day.saidaRealizada > 0 || day.operacoes !== 0;
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
                    <td className={`px-3 py-2 text-right ${day.operacoes >= 0 ? 'text-purple-600' : 'text-purple-700'}`}>
                      {day.operacoes !== 0 ? formatCurrency(day.operacoes) : '-'}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${day.saldoFinalPrevisto >= 0 ? 'text-blue-700' : 'text-destructive'}`}>
                      {formatCurrency(day.saldoFinalPrevisto)}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${day.saldoFinalRealizado >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatCurrency(day.saldoFinalRealizado)}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${day.saldoFinal >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatCurrency(day.saldoFinal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 bg-card z-10">
              <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                <td className="px-3 py-2.5 text-foreground" colSpan={2}>TOTAIS</td>
                <td className="px-3 py-2.5 text-right text-blue-600">{formatCurrency(totals.entradaPrevista)}</td>
                <td className="px-3 py-2.5 text-right text-primary">{formatCurrency(totals.entradaRealizada)}</td>
                <td className="px-3 py-2.5 text-right text-orange-500">{formatCurrency(totals.saidaPrevista)}</td>
                <td className="px-3 py-2.5 text-right text-destructive">{formatCurrency(totals.saidaRealizada)}</td>
                <td className="px-3 py-2.5 text-right text-purple-600">{formatCurrency(totals.operacoes)}</td>
                <td className={`px-3 py-2.5 text-right ${(saldoInicialPeriodo + totals.entradaPrevista - totals.saidaPrevista) >= 0 ? 'text-blue-700' : 'text-destructive'}`}>{formatCurrency(saldoInicialPeriodo + totals.entradaPrevista - totals.saidaPrevista)}</td>
                <td className={`px-3 py-2.5 text-right ${(saldoInicialPeriodo + totals.entradaRealizada - totals.saidaRealizada - totals.operacoes) >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(saldoInicialPeriodo + totals.entradaRealizada - totals.saidaRealizada - totals.operacoes)}</td>
                <td className={`px-3 py-2.5 text-right ${saldoFinalPeriodo >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(saldoFinalPeriodo)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
