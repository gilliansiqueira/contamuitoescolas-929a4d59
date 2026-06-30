/**
 * Audit engine for Sponte (Recebimentos) imports.
 *
 * Pure TypeScript — no React, no Supabase, no I/O. Drives a 4-step wizard:
 *   1. Conferência   — totals from file × totals already in system, per method.
 *   2. Simulação delay — show before/after delay distribution per month/method.
 *   3. Simulação de substituição — what will be removed, what will be inserted.
 *   4. Auditoria pós-importação — re-check after writes.
 *
 * Weekend rule: due dates falling on Sat/Sun shift to next Monday (reuses
 * addDaysAndAdjust). Differences caused by this shift are flagged as
 * "weekend-expected", NOT as errors.
 *
 * Credito vs Debito are NEVER collapsed. simulateDelays validates that a
 * debito entry never receives a credit-style delay.
 */

import type { FinancialEntry, PaymentDelayRule } from '@/types/financial';
import {
  PAYMENT_METHOD_ORDER,
  methodLabel,
  resolveMethodKey,
  type PaymentMethodKey,
} from './methodMapping';
import { addDaysAndAdjust, toNextBusinessDay, isWeekend } from '@/lib/dateUtils';


// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedRow {
  /** Original spreadsheet line (1-indexed, header = 1). */
  lineNumber: number;
  /** Raw vencimento date as YYYY-MM-DD. */
  dataVencimento: string;
  valor: number;
  /** Original method label from the file. */
  metodoRaw: string;
  /** Canonical key — null when unknown (blocking). */
  metodoKey: PaymentMethodKey | null;
  nomeAluno?: string;
}

export interface ConferenceLine {
  method: PaymentMethodKey;
  label: string;
  arquivoValor: number;
  arquivoQtd: number;
  sistemaValor: number;
  sistemaQtd: number;
  diferencaValor: number;
  diferencaQtd: number;
}

export interface ConferenceReport {
  perMethod: ConferenceLine[];
  totalArquivo: number;
  totalSistema: number;
  diferencaTotal: number;
  totalRegistrosArquivo: number;
  totalRegistrosSistema: number;
}

export interface DelaySimulationMovement {
  metodo: PaymentMethodKey;
  dataOriginal: string;
  dataAjustada: string;
  valor: number;
  prazoDias: number;
  weekendAdjusted: boolean;
}

export interface MonthlyBucket {
  /** YYYY-MM → { method → total } */
  [month: string]: Partial<Record<PaymentMethodKey, number>>;
}

export interface DelaySimulationResult {
  antes: MonthlyBucket;
  depois: MonthlyBucket;
  movimentos: DelaySimulationMovement[];
  /** Hard validation errors (e.g. debit row given credit delay). */
  errors: string[];
}

export interface ReplacementFilter {
  /** Origem to scope the removal — usually 'sponte'. */
  origem: string;
  /** Optional: restrict by canonical method key. */
  metodoKey?: PaymentMethodKey;
  /** YYYY-MM-DD lower bound (inclusive). */
  desde: string;
  /** YYYY-MM-DD upper bound (inclusive). Optional → no upper bound. */
  ate?: string;
}

export interface ReplacementSimulation {
  remover: { count: number; valor: number; ids: string[] };
  inserir: { count: number; valor: number };
  saldoEsperado: number;
  diferenca: number;
  /** True when |diferenca| > 0.01 — caller should block import. */
  bloqueia: boolean;
}

export interface PostImportAudit {
  perMethod: ConferenceLine[];
  diferencaTotal: number;
  diferencaRegistros: number;
  /** Diffs explainable purely by weekend shift (informational, not errors). */
  weekendOnly: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumBy<T>(arr: T[], get: (x: T) => number): number {
  return round2(arr.reduce((s, x) => s + get(x), 0));
}

function findDelayDays(method: PaymentMethodKey, rules: PaymentDelayRule[]): number {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const rule = rules.find(r => {
    const k = norm(r.formaCobranca);
    // Matchers estritos — cada método busca SUA própria regra. Nunca
    // reaproveita o delay de outro método (especialmente débito ≠ crédito).
    if (method === 'credito') return k.includes('credito') && !k.includes('debito');
    if (method === 'debito') return k.includes('debito');
    if (method === 'boleto_sponte_pay') return k.includes('boleto sponte') || k.includes('boleto-sponte');
    if (method === 'sponte_pay') {
      return (k.includes('sponte pay') || k === 'sponte' || k === 'spontepay')
        && !k.includes('boleto');
    }
    if (method === 'cheque_pre_datado') {
      return k.includes('pre datado') || k.includes('pre-datado') || k.includes('predatado');
    }
    if (method === 'cheque') return k.includes('cheque') && !k.includes('pre');
    if (method === 'boleto') {
      return (k.includes('boleto') || k.includes('cobranca')) && !k.includes('sponte');
    }
    if (method === 'pix') return k.includes('pix');
    if (method === 'dinheiro') return k.includes('dinheiro') || k.includes('especie');
    return false;
  });
  return rule?.prazo ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Conference report
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the per-method comparison between parsed file rows and the entries
 * already stored in the system (filtered to the same origem and period).
 *
 * Caller chooses what "sistema" rows to feed — typically:
 *   sistema = existing financial_entries WHERE school_id=X AND origem='sponte'
 *             AND data BETWEEN minNewDate AND maxNewDate
 */
export function buildConferenceReport(
  parsed: ParsedRow[],
  sistema: FinancialEntry[],
): ConferenceReport {
  const perMethod: ConferenceLine[] = PAYMENT_METHOD_ORDER.map(method => {
    const arquivoRows = parsed.filter(p => p.metodoKey === method);
    const sistemaRows = sistema.filter(s => resolveMethodKey(s.categoria || '') === method);
    const arquivoValor = sumBy(arquivoRows, r => r.valor);
    const sistemaValor = sumBy(sistemaRows, r => r.valor);
    return {
      method,
      label: methodLabel(method),
      arquivoValor,
      arquivoQtd: arquivoRows.length,
      sistemaValor,
      sistemaQtd: sistemaRows.length,
      diferencaValor: round2(arquivoValor - sistemaValor),
      diferencaQtd: arquivoRows.length - sistemaRows.length,
    };
  }).filter(line => line.arquivoQtd > 0 || line.sistemaQtd > 0);

  const totalArquivo = sumBy(perMethod, l => l.arquivoValor);
  const totalSistema = sumBy(perMethod, l => l.sistemaValor);

  return {
    perMethod,
    totalArquivo,
    totalSistema,
    diferencaTotal: round2(totalArquivo - totalSistema),
    totalRegistrosArquivo: parsed.length,
    totalRegistrosSistema: sistema.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Delay simulation
// ─────────────────────────────────────────────────────────────────────────────

export function simulateDelays(
  parsed: ParsedRow[],
  rules: PaymentDelayRule[],
): DelaySimulationResult {
  const antes: MonthlyBucket = {};
  const depois: MonthlyBucket = {};
  const movimentos: DelaySimulationMovement[] = [];
  const errors: string[] = [];

  for (const row of parsed) {
    if (!row.metodoKey) {
      errors.push(`Linha ${row.lineNumber}: método "${row.metodoRaw}" não reconhecido`);
      continue;
    }
    const method = row.metodoKey;
    // Política nova: respeitar EXCLUSIVAMENTE o prazo configurado pelo usuário
    // para o método. Sem regras fixas tipo "Dinheiro à vista" ou "Débito sem
    // prazo" — se o usuário configurou N dias, aplicamos N dias.
    const prazo = findDelayDays(method, rules);

    const dataAjustada = prazo > 0
      ? addDaysAndAdjust(row.dataVencimento, prazo)
      : toNextBusinessDay(row.dataVencimento);
    const weekendAdjusted = isWeekend(prazo > 0
      ? addDaysToISO(row.dataVencimento, prazo)
      : row.dataVencimento);


    const mesAntes = row.dataVencimento.slice(0, 7);
    const mesDepois = dataAjustada.slice(0, 7);

    antes[mesAntes] = antes[mesAntes] || {};
    antes[mesAntes][method] = round2((antes[mesAntes][method] || 0) + row.valor);
    depois[mesDepois] = depois[mesDepois] || {};
    depois[mesDepois][method] = round2((depois[mesDepois][method] || 0) + row.valor);

    movimentos.push({
      metodo: method,
      dataOriginal: row.dataVencimento,
      dataAjustada,
      valor: row.valor,
      prazoDias: prazo,
      weekendAdjusted,
    });
  }

  return { antes, depois, movimentos, errors };
}

function addDaysToISO(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Replacement simulation (deterministic)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the deterministic preview of a replacement operation.
 *
 * `existentes` should be the candidate set already filtered by school + origem.
 * `incoming` is the parsed list that will be inserted.
 */
export function simulateReplacement(
  existentes: FinancialEntry[],
  incoming: ParsedRow[],
  filter: ReplacementFilter,
): ReplacementSimulation {
  const toRemove = existentes.filter(e => {
    if (e.origem !== filter.origem) return false;
    if (e.tipoRegistro !== 'projetado') return false;
    if (e.editadoManualmente) return false;
    if (e.data < filter.desde) return false;
    if (filter.ate && e.data > filter.ate) return false;
    if (filter.metodoKey) {
      const k = resolveMethodKey(e.categoria || '');
      if (k !== filter.metodoKey) return false;
    }
    return true;
  });

  const validIncoming = incoming.filter(r => r.metodoKey != null);
  const removerValor = sumBy(toRemove, e => e.valor);
  const inserirValor = sumBy(validIncoming, r => r.valor);
  const diferenca = round2(inserirValor - removerValor);

  return {
    remover: { count: toRemove.length, valor: removerValor, ids: toRemove.map(e => e.id) },
    inserir: { count: validIncoming.length, valor: inserirValor },
    saldoEsperado: diferenca,
    diferenca,
    bloqueia: Math.abs(diferenca) > 0.01,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) Post-import audit
// ─────────────────────────────────────────────────────────────────────────────

export function runPostImportAudit(
  arquivo: ParsedRow[],
  sistemaAposGravacao: FinancialEntry[],
): PostImportAudit {
  const report = buildConferenceReport(arquivo, sistemaAposGravacao);
  const movs = simulateDelays(arquivo, []).movimentos;
  // weekendOnly = every non-zero diferencaValor is explainable by weekend shift
  const weekendOnly = report.perMethod.every(l =>
    Math.abs(l.diferencaValor) < 0.01
    || movs.some(m => m.metodo === l.method && m.weekendAdjusted),
  );
  return {
    perMethod: report.perMethod,
    diferencaTotal: report.diferencaTotal,
    diferencaRegistros: report.totalRegistrosArquivo - report.totalRegistrosSistema,
    weekendOnly,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience — convert ParsedRow → FinancialEntry rows ready to insert
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildEntriesOpts {
  schoolId: string;
  uploadId: string;
  fileName: string;
  rules: PaymentDelayRule[];
  /** Stamped on every entry. */
  importedAt?: string;
}

export interface InsertableEntry extends FinancialEntry {
  data_original?: string;
  delay_rule_applied?: { days: number; weekend_adjustment: boolean; source_method: string };
  payment_method_key?: PaymentMethodKey;
  source_file?: string;
  imported_at?: string;
}

export function buildInsertableEntries(
  parsed: ParsedRow[],
  opts: BuildEntriesOpts,
): InsertableEntry[] {
  const stamp = opts.importedAt ?? new Date().toISOString();
  const out: InsertableEntry[] = [];
  for (const row of parsed) {
    if (!row.metodoKey) continue;
    const prazo = findDelayDays(row.metodoKey, opts.rules);
    const dataFinal = prazo > 0
      ? addDaysAndAdjust(row.dataVencimento, prazo)
      : toNextBusinessDay(row.dataVencimento);
    const weekendAdjusted = dataFinal !== (prazo > 0 ? addDaysToISO(row.dataVencimento, prazo) : row.dataVencimento);
    out.push({
      id: crypto.randomUUID(),
      data: dataFinal,
      descricao: `Recebimento - ${row.nomeAluno || ''}`.trim(),
      valor: Math.abs(row.valor),
      tipo: 'entrada',
      categoria: methodLabel(row.metodoKey),
      origem: 'sponte',
      school_id: opts.schoolId,
      origem_upload_id: opts.uploadId,
      tipoRegistro: 'projetado',
      editadoManualmente: false,
      data_original: row.dataVencimento,
      delay_rule_applied: {
        days: prazo,
        weekend_adjustment: weekendAdjusted,
        source_method: row.metodoRaw,
      },
      payment_method_key: row.metodoKey,
      source_file: opts.fileName,
      imported_at: stamp,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// File-only summary (no system comparison)
// ─────────────────────────────────────────────────────────────────────────────

export interface FileSummaryLine {
  method: PaymentMethodKey;
  label: string;
  valor: number;
  qtd: number;
}

export interface FileSummary {
  perMethod: FileSummaryLine[];
  total: number;
  totalRegistros: number;
  dataMin: string;
  dataMax: string;
  unrecognized: { lineNumber: number; metodoRaw: string }[];
}

export function buildFileSummary(parsed: ParsedRow[]): FileSummary {
  const perMethod: FileSummaryLine[] = PAYMENT_METHOD_ORDER.map(method => {
    const rs = parsed.filter(p => p.metodoKey === method);
    return {
      method,
      label: methodLabel(method),
      valor: sumBy(rs, r => r.valor),
      qtd: rs.length,
    };
  }).filter(l => l.qtd > 0);

  const datas = parsed.map(p => p.dataVencimento).sort();
  return {
    perMethod,
    total: sumBy(perMethod, l => l.valor),
    totalRegistros: parsed.length,
    dataMin: datas[0] ?? '',
    dataMax: datas[datas.length - 1] ?? '',
    unrecognized: parsed
      .filter(p => p.metodoKey == null)
      .map(p => ({ lineNumber: p.lineNumber, metodoRaw: p.metodoRaw })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Month movements (visualização "antes × depois" do delay)
// ─────────────────────────────────────────────────────────────────────────────

export interface MonthMethodTotal {
  method: PaymentMethodKey;
  label: string;
  antes: number;
  depois: number;
  delta: number;
}

export interface MonthBreakdown {
  month: string;            // YYYY-MM
  antesTotal: number;
  depoisTotal: number;
  delta: number;            // depois - antes
  perMethod: MonthMethodTotal[];
}

export interface FlowBetweenMonths {
  fromMonth: string;
  toMonth: string;
  method: PaymentMethodKey;
  label: string;
  valor: number;
  qtd: number;
}

export interface DelayVisualization {
  months: MonthBreakdown[];
  flows: FlowBetweenMonths[];
  totalMovido: number;
  totalRegistrosMovidos: number;
}

export function buildDelayVisualization(sim: DelaySimulationResult): DelayVisualization {
  const monthSet = new Set<string>();
  Object.keys(sim.antes).forEach(m => monthSet.add(m));
  Object.keys(sim.depois).forEach(m => monthSet.add(m));
  const months = [...monthSet].sort();

  const breakdown: MonthBreakdown[] = months.map(m => {
    const antes = sim.antes[m] || {};
    const depois = sim.depois[m] || {};
    const methodKeys = new Set<PaymentMethodKey>([
      ...(Object.keys(antes) as PaymentMethodKey[]),
      ...(Object.keys(depois) as PaymentMethodKey[]),
    ]);
    const perMethod: MonthMethodTotal[] = PAYMENT_METHOD_ORDER
      .filter(k => methodKeys.has(k))
      .map(k => {
        const a = round2(antes[k] ?? 0);
        const d = round2(depois[k] ?? 0);
        return { method: k, label: methodLabel(k), antes: a, depois: d, delta: round2(d - a) };
      });
    const antesTotal = sumBy(perMethod, x => x.antes);
    const depoisTotal = sumBy(perMethod, x => x.depois);
    return { month: m, antesTotal, depoisTotal, delta: round2(depoisTotal - antesTotal), perMethod };
  });

  // Fluxos detalhados entre meses (origem → destino, por método).
  const flowMap = new Map<string, FlowBetweenMonths>();
  let totalMovido = 0;
  let totalRegistrosMovidos = 0;
  for (const mov of sim.movimentos) {
    const from = mov.dataOriginal.slice(0, 7);
    const to = mov.dataAjustada.slice(0, 7);
    if (from === to) continue;
    const key = `${from}→${to}|${mov.metodo}`;
    const cur = flowMap.get(key);
    if (cur) {
      cur.valor = round2(cur.valor + mov.valor);
      cur.qtd += 1;
    } else {
      flowMap.set(key, {
        fromMonth: from,
        toMonth: to,
        method: mov.metodo,
        label: methodLabel(mov.metodo),
        valor: round2(mov.valor),
        qtd: 1,
      });
    }
    totalMovido += mov.valor;
    totalRegistrosMovidos += 1;
  }

  const flows = [...flowMap.values()].sort((a, b) =>
    a.fromMonth.localeCompare(b.fromMonth)
    || a.toMonth.localeCompare(b.toMonth)
    || b.valor - a.valor,
  );

  return {
    months: breakdown,
    flows,
    totalMovido: round2(totalMovido),
    totalRegistrosMovidos,
  };
}

