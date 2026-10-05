/**
 * Cálculo dia a dia do Fluxo Diário (realizado até o último dia com movimento real,
 * previsto depois). Compartilhado entre Fluxo Diário e Simulação — não duplicar.
 */
import { resolveEntryLedgerRule } from '@/lib/ledgerEngine';
import { resolveTipoMeta } from '@/lib/tipoMeta';
import { isWeekend, getDayOfWeek } from '@/lib/dateUtils';
import { IGNORADO_ENTRADA, IGNORADO_SAIDA } from '@/lib/bankCashflowOverlay';
import type { ProjectedEntry } from '@/lib/projectionEngine';
import type { TypeClassification } from '@/types/financial';

const IGNORADOS_BANCO = new Set([IGNORADO_ENTRADA, IGNORADO_SAIDA]);

export interface DayRow {
  data: string;
  saldoFinalPrevisto: number;
  saldoFinalRealizado: number;
  saldoFinalProjecao: number;
  entradaPrevista: number;
  entradaRealizada: number;
  saidaPrevista: number;
  saidaRealizada: number;
  operacoes: number;
  ignorados: number;
  saldoFinal: number;
  isWeekend: boolean;
  dayOfWeek: string;
  isAfterCutoff: boolean;
  isCutoff: boolean;
}

export interface BuildDailyRowsInput {
  allDays: string[];
  priorSaldo: number;
  projected: ProjectedEntry[];
  realized: ProjectedEntry[];
  classifications: TypeClassification[];
  historicalRows: { month: string; tipo_valor: string; valor: number | string }[];
  monthSources: Record<string, string>;
  modelItems: any;
}

export function buildDailyRows({ allDays, priorSaldo, projected, realized, classifications, historicalRows, monthSources, modelItems }: BuildDailyRowsInput): DayRow[] {
  const daySet = new Set(allDays);
  const byDate: Record<string, { entradaPrevista: number; entradaRealizada: number; saidaPrevista: number; saidaRealizada: number; operacoesPrev: number; operacoesReal: number; ignorados: number }> = {};
  const ensureDay = (data: string) => {
    if (!byDate[data]) byDate[data] = { entradaPrevista: 0, entradaRealizada: 0, saidaPrevista: 0, saidaRealizada: 0, operacoesPrev: 0, operacoesReal: 0, ignorados: 0 };
    return byDate[data];
  };
  // Meses com fluxo realizado dia a dia: histórico mensal não soma de novo.
  const mesesComFluxoDiario = new Set(realized.map(e => e.data.slice(0, 7)));
  historicalRows.forEach(r => {
    if (monthSources[r.month] !== 'historico') return;
    if (mesesComFluxoDiario.has(r.month)) return;
    const monthDays = allDays.filter(d => d.startsWith(r.month));
    const data = monthDays[monthDays.length - 1];
    if (!data) return;
    const meta = resolveTipoMeta(r.tipo_valor, classifications, modelItems);
    if (!meta.impactaCaixa) return;
    const valor = Number(r.valor) || 0;
    if (valor === 0) return;
    const d = ensureDay(data);
    if (!meta.entraNoResultado) d.operacoesReal += meta.sinal === 'somar' ? valor : -valor;
    else if (meta.sinal === 'somar') d.entradaRealizada += valor;
    else d.saidaRealizada += valor;
  });
  projected.forEach(e => {
    const data = e.dataProjetada;
    if (!daySet.has(data)) return;
    ensureDay(data);
    const impact = e.impacto;
    if (impact === 0) return;
    if (!resolveEntryLedgerRule(e, classifications).entraNoResultado) { byDate[data].operacoesPrev += impact; return; }
    if (impact > 0) byDate[data].entradaPrevista += impact; else byDate[data].saidaPrevista += Math.abs(impact);
  });
  realized.forEach(e => {
    const data = e.data;
    if (!daySet.has(data)) return;
    ensureDay(data);
    const impact = e.impacto;
    if (impact === 0) return;
    if (IGNORADOS_BANCO.has((e as any).tipoOriginal ?? '')) { byDate[data].ignorados += impact; return; }
    if (!resolveEntryLedgerRule(e, classifications).entraNoResultado) { byDate[data].operacoesReal += impact; return; }
    if (impact > 0) byDate[data].entradaRealizada += impact; else byDate[data].saidaRealizada += Math.abs(impact);
  });
  // Cutoff: último dia com QUALQUER movimento realizado.
  const cutoffIdx = allDays.reduce((last, data, i) => {
    const d = byDate[data];
    if (d && (d.entradaRealizada > 0 || d.saidaRealizada > 0 || d.operacoesReal !== 0 || d.ignorados !== 0)) return i;
    return last;
  }, -1);
  let saldo = priorSaldo, saldoPrev = priorSaldo, saldoReal = priorSaldo, saldoProj = priorSaldo;
  return allDays.map((data, i) => {
    const d = byDate[data] || { entradaPrevista: 0, entradaRealizada: 0, saidaPrevista: 0, saidaRealizada: 0, operacoesPrev: 0, operacoesReal: 0, ignorados: 0 };
    const isAfterCutoff = cutoffIdx >= 0 && i > cutoffIdx;
    // Até o último dia realizado, Operações mostra só o que aconteceu (previsões antigas não somam).
    const operacoes = cutoffIdx >= 0 && !isAfterCutoff ? d.operacoesReal : d.operacoesPrev + d.operacoesReal;
    saldo += (d.entradaPrevista + d.entradaRealizada) - (d.saidaPrevista + d.saidaRealizada) + d.operacoesPrev + d.operacoesReal + d.ignorados;
    saldoPrev += d.entradaPrevista - d.saidaPrevista + d.operacoesPrev;
    saldoReal += d.entradaRealizada - d.saidaRealizada + d.operacoesReal + d.ignorados;
    if (!isAfterCutoff) saldoProj += d.entradaRealizada - d.saidaRealizada + d.operacoesReal + d.ignorados;
    else saldoProj += d.entradaPrevista - d.saidaPrevista + d.operacoesPrev;
    return {
      data, entradaPrevista: d.entradaPrevista, entradaRealizada: d.entradaRealizada, saidaPrevista: d.saidaPrevista, saidaRealizada: d.saidaRealizada,
      operacoes, ignorados: d.ignorados, saldoFinal: saldo, saldoFinalPrevisto: saldoPrev, saldoFinalRealizado: saldoReal, saldoFinalProjecao: saldoProj,
      isWeekend: isWeekend(data), dayOfWeek: getDayOfWeek(data), isAfterCutoff,
      isCutoff: i === cutoffIdx && cutoffIdx >= 0 && cutoffIdx < allDays.length - 1,
    };
  });
}

/** Previsto de fechamento: realizado até o corte + previsto só dos dias futuros. */
export function closingEstimate(rows: DayRow[]) {
  const t = rows.reduce((a, d) => ({ er: a.er + d.entradaRealizada, sr: a.sr + d.saidaRealizada, op: a.op + d.operacoes }), { er: 0, sr: 0, op: 0 });
  const hasRealized = t.er > 0 || t.sr > 0;
  const rest = rows.reduce((a, d) => (hasRealized && !d.isAfterCutoff) ? a : { e: a.e + d.entradaPrevista, s: a.s + d.saidaPrevista }, { e: 0, s: 0 });
  return { entrada: t.er + rest.e, saida: t.sr + rest.s, entradaRealizada: t.er, entradaRestante: rest.e, operacoes: t.op };
}
