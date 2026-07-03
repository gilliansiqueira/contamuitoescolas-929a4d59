import { useCallback, useMemo } from 'react';
import { useProjectedEntries } from '@/hooks/useProjectedEntries';
import { usePeriodMovementCtx } from '@/hooks/usePeriodMovementCtx';
import { useEntries, useTypeClassifications } from '@/hooks/useFinancialData';
import { getSaldoImpact } from '@/lib/classificationUtils';
import { resolveEntryLedgerRule } from '@/lib/ledgerEngine';
import { resolveTipoMeta } from '@/lib/tipoMeta';
import {
  resolveMonthSource,
  includeEntryForMonth,
  computeSaldoInicial,
  computeSaldoFinal,
  type MovementSource,
} from '@/lib/periodMovement';
import { getAllDaysInMonths, isWeekend, getDayOfWeek, formatDateBR } from '@/lib/dateUtils';
import { motion } from 'framer-motion';
import { Table2 } from 'lucide-react';
import type { FinancialEntry } from '@/types/financial';
import type { ProjectedEntry } from '@/lib/projectionEngine';

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
  const { entries: projectedEntries } = useProjectedEntries(schoolId);
  const { data: rawEntries = [] } = useEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const { ctx: movementCtx, isInModel } = usePeriodMovementCtx(schoolId);

  const historicalRows = movementCtx.historicalRows;
  const snapshotMap = movementCtx.snapshotMap;
  const modelItems = movementCtx.modelItems;

  const months = useMemo(() => {
    if (selectedMonth === 'all') {
      const set = new Set<string>();
      projectedEntries.forEach(e => set.add(e.dataProjetada.slice(0, 7)));
      rawEntries.forEach(e => set.add(e.data.slice(0, 7)));
      historicalRows.forEach(r => set.add(r.month));
      snapshotMap.forEach((_, month) => set.add(month));
      return Array.from(set).sort();
    }
    return selectedMonth.split(',').filter(Boolean).sort();
  }, [selectedMonth, projectedEntries, rawEntries, historicalRows, snapshotMap]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // SSOT: fonte por mês.
  const monthSources = useMemo<Record<string, MovementSource>>(() => {
    const result: Record<string, MovementSource> = {};
    for (const m of months) result[m] = resolveMonthSource(m, movementCtx);
    return result;
  }, [months, movementCtx]);

  // Filtro canônico: same rule as periodMovement.
  const filterForMonth = useCallback(
    (e: ProjectedEntry) => {
      const src = monthSources[e.dataProjetada.slice(0, 7)];
      if (!src) return false;
      return includeEntryForMonth(e, src, todayStr, classifications);
    },
    [monthSources, todayStr, classifications]
  );

  const adjustedProjectedEntries = useMemo(
    () => projectedEntries.filter(e => {
      if (e.origem === 'fluxo' || e.impacto === 0) return false;
      return filterForMonth(e);
    }),
    [projectedEntries, filterForMonth]
  );

  const realizedEntries = useMemo(
    () => rawEntries
      .filter(e => e.origem === 'fluxo')
      .map(e => ({ ...e, dataProjetada: e.data, impacto: getSaldoImpact(e, classifications) }) as ProjectedEntry)
      .filter(e => {
        if (e.impacto === 0) return false;
        return filterForMonth(e);
      }),
    [rawEntries, classifications, filterForMonth]
  );

  const allDays = useMemo(() => getAllDaysInMonths(months), [months]);

  // SSOT: saldo inicial e final vindos direto da mesma função canônica.
  const saldoInicialPeriodo = useMemo(() => {
    if (months.length === 0) return movementCtx.saldoInicialBase;
    return computeSaldoInicial(months[0], movementCtx, { isInModel });
  }, [months, movementCtx, isInModel]);

  const saldoFinalPeriodoSSOT = useMemo(() => {
    if (months.length === 0) return saldoInicialPeriodo;
    return computeSaldoFinal(months[months.length - 1], movementCtx, { isInModel });
  }, [months, movementCtx, isInModel, saldoInicialPeriodo]);


  const dailyData = useMemo(() => {
    const priorSaldo = saldoInicialPeriodo;

    const byDate: Record<string, { entradaPrevista: number; entradaRealizada: number; saidaPrevista: number; saidaRealizada: number; operacoesPrev: number; operacoesReal: number }> = {};
    const ensureDay = (data: string) => {
      if (!byDate[data]) byDate[data] = { entradaPrevista: 0, entradaRealizada: 0, saidaPrevista: 0, saidaRealizada: 0, operacoesPrev: 0, operacoesReal: 0 };
      return byDate[data];
    };

    historicalRows.forEach(r => {
      if (monthSources[r.month] !== 'historico') return;
      const monthDays = allDays.filter(d => d.startsWith(r.month));
      const data = monthDays[monthDays.length - 1];
      if (!data) return;
      const meta = resolveTipoMeta(r.tipo_valor, classifications, modelItems);
      if (!meta.impactaCaixa) return;
      const valor = Number(r.valor) || 0;
      if (valor === 0) return;
      const d = ensureDay(data);
      if (!meta.entraNoResultado) {
        d.operacoesReal += meta.sinal === 'somar' ? valor : -valor;
      } else if (meta.sinal === 'somar') {
        d.entradaRealizada += valor;
      } else {
        d.saidaRealizada += valor;
      }
    });

    adjustedProjectedEntries.forEach(e => {
      const data = e.dataProjetada;
      if (!allDays.includes(data)) return;
      ensureDay(data);
      const impact = e.impacto;
      if (impact === 0) return;
      // Operação (entraNoResultado=false) impacta caixa mas vai para coluna Operações
      if (!resolveEntryLedgerRule(e, classifications).entraNoResultado) {
        byDate[data].operacoesPrev += impact;
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
      ensureDay(data);
      const impact = e.impacto;
      if (impact === 0) return;
      if (!resolveEntryLedgerRule(e, classifications).entraNoResultado) {
        byDate[data].operacoesReal += impact;
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
      const d = byDate[data] || { entradaPrevista: 0, entradaRealizada: 0, saidaPrevista: 0, saidaRealizada: 0, operacoesPrev: 0, operacoesReal: 0 };
      const operacoes = d.operacoesPrev + d.operacoesReal;
      saldo += (d.entradaPrevista + d.entradaRealizada) - (d.saidaPrevista + d.saidaRealizada) + operacoes;
      saldoPrev += d.entradaPrevista - d.saidaPrevista + d.operacoesPrev;
      saldoReal += d.entradaRealizada - d.saidaRealizada + d.operacoesReal;
      return {
        data,
        entradaPrevista: d.entradaPrevista,
        entradaRealizada: d.entradaRealizada,
        saidaPrevista: d.saidaPrevista,
        saidaRealizada: d.saidaRealizada,
        operacoes,
        saldoFinal: saldo,
        saldoFinalPrevisto: saldoPrev,
        saldoFinalRealizado: saldoReal,
        isWeekend: isWeekend(data),
        dayOfWeek: getDayOfWeek(data),
      } as DayRow;
    });
  }, [allDays, adjustedProjectedEntries, realizedEntries, saldoInicialPeriodo, classifications, historicalRows, monthSources, modelItems]);

  // Saldo final oficial vem da SSOT (invariante saldoInicial(M+1) = saldoFinal(M)).
  const saldoFinalPeriodo = saldoFinalPeriodoSSOT;

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
                <td className={`px-3 py-2.5 text-right ${(dailyData.length ? dailyData[dailyData.length-1].saldoFinalPrevisto : saldoInicialPeriodo) >= 0 ? 'text-blue-700' : 'text-destructive'}`}>{formatCurrency(dailyData.length ? dailyData[dailyData.length-1].saldoFinalPrevisto : saldoInicialPeriodo)}</td>
                <td className={`px-3 py-2.5 text-right ${(dailyData.length ? dailyData[dailyData.length-1].saldoFinalRealizado : saldoInicialPeriodo) >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(dailyData.length ? dailyData[dailyData.length-1].saldoFinalRealizado : saldoInicialPeriodo)}</td>


              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
