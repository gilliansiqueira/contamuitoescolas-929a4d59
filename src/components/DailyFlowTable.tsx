import { BANK_SMALL_DIFF_TOLERANCE } from '@/lib/bankStatements/confirmedBalance';
import { Fragment, useCallback, useMemo } from 'react';
import { useProjectedEntries } from '@/hooks/useProjectedEntries';
import { usePeriodMovementCtx } from '@/hooks/usePeriodMovementCtx';
import { useConfirmedBankBalance } from '@/hooks/useConfirmedBankBalance';
import { useEntries, useTypeClassifications } from '@/hooks/useFinancialData';
import { getSaldoImpact } from '@/lib/classificationUtils';
import { resolveEntryLedgerRule } from '@/lib/ledgerEngine';
import { resolveTipoMeta } from '@/lib/tipoMeta';
import {
  resolveMonthSource,
  
  computeSaldoInicial,
  computeSaldoFinal,
  type MovementSource,
} from '@/lib/periodMovement';
import { getAllDaysInMonths, isWeekend, getDayOfWeek, formatDateBR } from '@/lib/dateUtils';
import { motion } from 'framer-motion';
import { Table2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { CompactStat } from '@/components/mobile/CompactStat';
import { buildDailyRows } from '@/lib/dailyFlow';
import type { FinancialEntry } from '@/types/financial';
import type { ProjectedEntry } from '@/lib/projectionEngine';
import { IGNORADO_ENTRADA, IGNORADO_SAIDA } from '@/lib/bankCashflowOverlay';
const IGNORADOS_BANCO = new Set([IGNORADO_ENTRADA, IGNORADO_SAIDA]);

interface DailyFlowTableProps {
  schoolId: string;
  selectedMonth: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function DailyFlowTable({ schoolId, selectedMonth }: DailyFlowTableProps) {
  const isMobile = useIsMobile();
  const { entries: projectedEntries } = useProjectedEntries(schoolId);
  const { data: rawEntries = [] } = useEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const { ctx: movementCtx, isInModel } = usePeriodMovementCtx(schoolId);
  const { confirmed: confirmedBalance } = useConfirmedBankBalance(schoolId);

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

  // No Fluxo Diário mostramos SEMPRE tudo que existir: projeções nas colunas
  // "Prevista" e fluxo/manual nas colunas "Realizada", em qualquer mês. A
  // regra SSOT de "fluxo substitui projeção" vale para os cards de Saldo
  // Final do período (que continuam usando periodMovement).
  const monthHasData = useCallback(
    (e: ProjectedEntry) => {
      const src = monthSources[e.dataProjetada.slice(0, 7)];
      return !!src && src !== 'vazio';
    },
    [monthSources]
  );

  const adjustedProjectedEntries = useMemo(
    () => projectedEntries.filter(e => {
      if ((e.origem === 'fluxo' && e.tipoRegistro !== 'projetado') || e.impacto === 0) return false;
      return monthHasData(e);
    }),
    [projectedEntries, monthHasData]
  );

  const realizedEntries = useMemo(
    () => rawEntries
       .filter(e => e.origem === 'fluxo' && e.tipoRegistro !== 'projetado')
      .map(e => ({ ...e, dataProjetada: e.data, impacto: getSaldoImpact(e, classifications) }) as ProjectedEntry)
      .filter(e => e.impacto !== 0),
    [rawEntries, classifications]
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


  const dailyData = useMemo(() => buildDailyRows({
    allDays, priorSaldo: saldoInicialPeriodo, projected: adjustedProjectedEntries, realized: realizedEntries,
    classifications, historicalRows: historicalRows as any, monthSources, modelItems,
  }), [allDays, adjustedProjectedEntries, realizedEntries, saldoInicialPeriodo, classifications, historicalRows, monthSources, modelItems]);

  // Saldo final oficial vem da SSOT (invariante saldoInicial(M+1) = saldoFinal(M)).
  const saldoFinalPeriodo = saldoFinalPeriodoSSOT;
  const lastMonth = months[months.length - 1];
   const lastCutoff = dailyData.find(d => d.data === confirmedBalance?.date);
  const confirmedForPeriod = selectedMonth !== 'all' && lastMonth === confirmedBalance?.date.slice(0, 7)
     && lastCutoff && projectedEntries.some(e => e.origem === 'fluxo' && e.tipoRegistro !== 'projetado' && e.dataProjetada === confirmedBalance.date)
     ? confirmedBalance : null;
  const bankDifference = confirmedForPeriod
    ? Math.round((confirmedForPeriod.balance - lastCutoff.saldoFinalRealizado) * 100) / 100 : 0;

  const totals = useMemo(() => dailyData.reduce((acc, d) => ({
    entradaPrevista: acc.entradaPrevista + d.entradaPrevista,
    entradaRealizada: acc.entradaRealizada + d.entradaRealizada,
    saidaPrevista: acc.saidaPrevista + d.saidaPrevista,
    saidaRealizada: acc.saidaRealizada + d.saidaRealizada,
    operacoes: acc.operacoes + d.operacoes,
    ignorados: acc.ignorados + d.ignorados,
  }), { entradaPrevista: 0, entradaRealizada: 0, saidaPrevista: 0, saidaRealizada: 0, operacoes: 0, ignorados: 0 }), [dailyData]);

  // Previsto de fechamento: realizado até o corte + previsto apenas dos dias futuros.
  // Sem nenhum realizado no período, todo o previsto conta como "restante".
  const closingEstimate = useMemo(() => {
    const hasRealized = totals.entradaRealizada > 0 || totals.saidaRealizada > 0;
    const restante = dailyData.reduce((acc, d) => {
      if (hasRealized && !d.isAfterCutoff) return acc;
      return { entrada: acc.entrada + d.entradaPrevista, saida: acc.saida + d.saidaPrevista };
    }, { entrada: 0, saida: 0 });
    return {
      entrada: totals.entradaRealizada + restante.entrada,
      saida: totals.saidaRealizada + restante.saida,
    };
  }, [dailyData, totals]);


  if (allDays.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
        Selecione um período para visualizar o fluxo diário.
      </div>
    );
  }

  if (isMobile) {
    const movementDays = dailyData.filter(
      d => d.entradaPrevista > 0 || d.entradaRealizada > 0 || d.saidaPrevista > 0 || d.saidaRealizada > 0 || d.operacoes !== 0
    );
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <CompactStat
            label="Saldo inicial"
            value={formatCurrency(saldoInicialPeriodo)}
            valueClassName={saldoInicialPeriodo >= 0 ? 'text-foreground' : 'text-destructive'}
          />
          <CompactStat
            label="Fechamento previsto"
            value={formatCurrency(saldoFinalPeriodo)}
            valueClassName={saldoFinalPeriodo >= 0 ? 'text-primary' : 'text-destructive'}
          />
          {confirmedForPeriod && <CompactStat label={`Saldo bancário em ${formatDateBR(confirmedForPeriod.date)}`} value={formatCurrency(confirmedForPeriod.balance)} valueClassName="text-success" />}
          {confirmedForPeriod && Math.abs(bankDifference) >= 0.005 && <CompactStat label={Math.abs(bankDifference) <= BANK_SMALL_DIFF_TOLERANCE ? 'A confirmar no próximo extrato' : 'Diferença a conferir'} value={formatCurrency(Math.abs(bankDifference))} valueClassName="text-warning" />}
          <CompactStat label="Entrada prevista" value={formatCurrency(totals.entradaPrevista)} valueClassName="text-blue-600 dark:text-blue-300" />
          <CompactStat label="Entrada realizada" value={formatCurrency(totals.entradaRealizada)} valueClassName="text-primary" />
          <CompactStat label="Saída prevista" value={formatCurrency(totals.saidaPrevista)} valueClassName="text-orange-500" />
          <CompactStat label="Saída realizada" value={formatCurrency(totals.saidaRealizada)} valueClassName="text-destructive" />
        </div>

        <div className="flex items-center justify-between px-1">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Dias com movimento</h3>
          <span className="text-[10px] text-muted-foreground">{movementDays.length} de {allDays.length} dias</span>
        </div>

        <div className="space-y-2">
          {movementDays.length === 0 && (
            <div className="glass-card rounded-lg p-4 text-center text-xs text-muted-foreground">
              Nenhum movimento no período.
            </div>
          )}
          {movementDays.map(day => {
            const showReal = !day.isAfterCutoff;
            return (
              <div key={day.data} className={`glass-card rounded-lg px-3 py-2 ${day.saldoFinalProjecao < 0 ? 'bg-destructive/5' : ''}`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-foreground">
                    {formatDateBR(day.data)} <span className="text-muted-foreground font-normal">· {day.dayOfWeek}</span>
                  </span>
                  <span className={`text-xs font-display font-bold ${day.saldoFinalProjecao >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    {formatCurrency(day.saldoFinalProjecao)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                  {day.entradaPrevista > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Ent. prev.</span><span className="text-blue-600 dark:text-blue-300 font-medium">{formatCurrency(day.entradaPrevista)}</span></div>
                  )}
                  {showReal && day.entradaRealizada > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Ent. real.</span><span className="text-primary font-medium">{formatCurrency(day.entradaRealizada)}</span></div>
                  )}
                  {day.saidaPrevista > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Saí. prev.</span><span className="text-orange-500 font-medium">{formatCurrency(day.saidaPrevista)}</span></div>
                  )}
                  {showReal && day.saidaRealizada > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Saí. real.</span><span className="text-destructive font-medium">{formatCurrency(day.saidaRealizada)}</span></div>
                  )}
                  {day.ignorados !== 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Ignorados (banco)</span><span className="text-muted-foreground font-medium">{formatCurrency(day.ignorados)}</span></div>
                  )}
                  {day.operacoes !== 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Operações</span><span className="text-purple-600 font-medium">{formatCurrency(day.operacoes)}</span></div>
                  )}
                </div>
                {day.isCutoff && (
                  <p className="mt-1.5 text-[9px] uppercase tracking-wider text-emerald-700 font-semibold">
                    Realizado até aqui · a seguir, previsão
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
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
             <span className="text-sm font-medium text-foreground">Fechamento previsto do período</span>
          </div>
          <span className={`text-lg font-display font-bold ${saldoFinalPeriodo >= 0 ? 'text-primary' : 'text-destructive'}`}>
            {formatCurrency(saldoFinalPeriodo)}
          </span>
        </div>
      </div>
      {confirmedForPeriod && <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-xs">
        <span className="font-semibold">Saldo bancário conferido em {formatDateBR(confirmedForPeriod.date)}: {formatCurrency(confirmedForPeriod.balance)}.</span>{' '}
        {Math.abs(bankDifference) >= 0.005 && <>{Math.abs(bankDifference) <= BANK_SMALL_DIFF_TOLERANCE ? 'A confirmar no próximo extrato' : 'Diferença a conferir com os extratos'}: {formatCurrency(Math.abs(bankDifference))}. </>}
        Fechamento previsto: {formatCurrency(saldoFinalPeriodo)}.
      </div>}

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
                <th className="px-3 py-2.5 text-right font-medium text-blue-600 dark:text-blue-300">Entrada Prevista</th>
                <th className="px-3 py-2.5 text-right font-medium text-primary">Entrada Realizada</th>
                <th className="px-3 py-2.5 text-right font-medium text-orange-500">Saída Prevista</th>
                <th className="px-3 py-2.5 text-right font-medium text-destructive">Saída Realizada</th>
                <th className="px-3 py-2.5 text-right font-medium text-purple-600">Operações</th>
                <th className="px-3 py-2.5 text-right font-medium text-blue-700 dark:text-blue-300">Saldo Final Previsto</th>
                <th className="px-3 py-2.5 text-right font-medium text-primary">Saldo Final Realizado</th>
                <th className="px-3 py-2.5 text-right font-medium text-emerald-600" title="Realizado até o último dia com movimento + previsto daí em diante">
                  Saldo Final Projetado
                </th>
              </tr>
            </thead>
            <tbody>
              {dailyData.map(day => {
                const hasMovement = day.entradaPrevista > 0 || day.entradaRealizada > 0 || day.saidaPrevista > 0 || day.saidaRealizada > 0 || day.operacoes !== 0;
                // Realizado só aparece até o corte; Previsto aparece SEMPRE
                // (assim vê-se quanto foi realizado + a previsão para fechar o mês).
                const showReal = !day.isAfterCutoff;
                const showPrev = true;
                return (
                  <Fragment key={day.data}>
                    {day.isCutoff && (
                      <tr key={`${day.data}-cut`} className="bg-emerald-500/5 border-t border-emerald-500/30">
                        <td colSpan={10} className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-emerald-700 font-semibold text-center">
                          ↑ Realizado até {formatDateBR(day.data)} · ↓ Previsão a partir do próximo dia
                        </td>
                      </tr>
                    )}
                    <tr
                      key={day.data}
                      className={`border-t border-border/30 ${
                        day.isWeekend ? 'bg-muted/30' : ''
                      } ${day.saldoFinal < 0 ? 'bg-destructive/5' : ''} ${
                        !hasMovement && !day.isWeekend ? 'opacity-60' : ''
                      } ${day.isAfterCutoff ? 'bg-blue-500/[0.03] dark:bg-blue-300/[0.06]' : ''}`}
                    >
                      <td className="px-3 py-2 font-medium text-foreground">{formatDateBR(day.data)}</td>
                      <td className={`px-3 py-2 ${day.isWeekend ? 'text-muted-foreground font-semibold' : 'text-muted-foreground'}`}>
                        {day.dayOfWeek}
                      </td>
                      <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-300">
                        {showPrev && day.entradaPrevista > 0 ? formatCurrency(day.entradaPrevista) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-primary">
                        {showReal && day.entradaRealizada > 0 ? formatCurrency(day.entradaRealizada) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-orange-500">
                        {showPrev && day.saidaPrevista > 0 ? formatCurrency(day.saidaPrevista) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-destructive">
                        {showReal && day.saidaRealizada > 0 ? formatCurrency(day.saidaRealizada) : '—'}
                      </td>
                      <td className={`px-3 py-2 text-right ${day.operacoes >= 0 ? 'text-purple-600' : 'text-purple-700'}`}>
                        {day.operacoes !== 0 ? formatCurrency(day.operacoes) : '—'}
                        {day.ignorados !== 0 && <div className="text-[10px] text-muted-foreground" title="Ignorado: conta só no saldo">ign. {formatCurrency(day.ignorados)}</div>}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${day.saldoFinalPrevisto >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-destructive'}`}>
                        {showPrev ? formatCurrency(day.saldoFinalPrevisto) : '—'}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${day.saldoFinalRealizado >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {showReal ? formatCurrency(day.saldoFinalRealizado) : '—'}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${day.saldoFinalProjecao >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                        {formatCurrency(day.saldoFinalProjecao)}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>

            <tfoot className="sticky bottom-0 bg-card z-10">
              <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                <td className="px-3 py-2.5 text-foreground" colSpan={2}>TOTAIS</td>
                <td className="px-3 py-2.5 text-right text-blue-600 dark:text-blue-300">{formatCurrency(totals.entradaPrevista)}</td>
                <td className="px-3 py-2.5 text-right text-primary">{formatCurrency(totals.entradaRealizada)}</td>
                <td className="px-3 py-2.5 text-right text-orange-500">{formatCurrency(totals.saidaPrevista)}</td>
                <td className="px-3 py-2.5 text-right text-destructive">{formatCurrency(totals.saidaRealizada)}</td>
                <td className="px-3 py-2.5 text-right text-purple-600">{formatCurrency(totals.operacoes)}{totals.ignorados !== 0 && <div className="text-[10px] font-normal text-muted-foreground">Ignorados (banco): {formatCurrency(totals.ignorados)}</div>}</td>
                <td className={`px-3 py-2.5 text-right ${(dailyData.length ? dailyData[dailyData.length-1].saldoFinalPrevisto : saldoInicialPeriodo) >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-destructive'}`}>{formatCurrency(dailyData.length ? dailyData[dailyData.length-1].saldoFinalPrevisto : saldoInicialPeriodo)}</td>
                <td className={`px-3 py-2.5 text-right ${(dailyData.length ? dailyData[dailyData.length-1].saldoFinalRealizado : saldoInicialPeriodo) >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(dailyData.length ? dailyData[dailyData.length-1].saldoFinalRealizado : saldoInicialPeriodo)}</td>
                <td className={`px-3 py-2.5 text-right font-bold ${(dailyData.length ? dailyData[dailyData.length-1].saldoFinalProjecao : saldoInicialPeriodo) >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{formatCurrency(dailyData.length ? dailyData[dailyData.length-1].saldoFinalProjecao : saldoInicialPeriodo)}</td>
              </tr>
              <tr className="border-t border-border/50 bg-muted/20">
                <td className="px-3 py-2.5 text-foreground font-bold italic" colSpan={2} title="Realizado até hoje + previsto dos dias futuros">
                  Previsto de fechamento
                </td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                <td className="px-3 py-2.5 text-right text-primary font-bold italic" title="Entrada realizada até hoje + entradas previstas dos dias futuros">
                  {formatCurrency(closingEstimate.entrada)}
                </td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                <td className="px-3 py-2.5 text-right text-destructive font-bold italic" title="Saída realizada até hoje + saídas previstas dos dias futuros">
                  {formatCurrency(closingEstimate.saida)}
                </td>
                <td className="px-3 py-2.5 text-right text-muted-foreground" colSpan={4}>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
