/**
 * SSOT única para movimentação e saldo por período.
 *
 * Nenhuma tela deve calcular receitas, despesas, operações ou saldo por
 * conta própria. Todas devem consumir:
 * - `buildMonthMovement(month, ctx)` → receitas/despesas/operações do mês
 * - `computeSaldoInicial(month, ctx)` → saldo final do mês anterior
 * - `computeSaldoFinal(month, ctx)` → saldo inicial + movimento do mês
 *
 * Regra invariante:
 *   saldoInicial(M) === saldoFinal(M-1)
 *   saldoFinal(M)   === saldoInicial(M) + movimento(M).saldoMovimento
 *
 * Regra de origem por mês (sem sobreposição):
 *   1. snapshot fechado      → valores congelados
 *   2. há entry origem='fluxo' → fluxo/manual + projeções futuras (>= hoje)
 *   3. há historical_monthly → histórico (rec/desp) + operações de entries
 *   4. há projeção            → todas as entries do mês
 *   5. senão                 → vazio
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Visão "Realizado" (apenas exibição — NÃO usada para herança de saldo):
 * Cada MonthMovement também expõe `receitasRealizadas`, `despesasRealizadas`
 * e `saldoMovimentoRealizado`, que somam apenas a parcela já efetivamente
 * realizada (fluxo importado + manuais com tipoRegistro='realizado' +
 * meses históricos/snapshot, que são sempre 100% realizados). A parcela
 * projetada (entries com tipoRegistro='projetado', ex.: Sponte/Cheques/
 * Cartões/Contas a Pagar após o corte do fluxo) fica de fora dessa soma.
 * `computeSaldoFinalRealizado`/`computeSaldoInicialRealizado` são as
 * versões paralelas de `computeSaldoFinal`/`computeSaldoInicial` para essa
 * visão. Nenhuma das duas altera a lógica existente de encadeamento entre
 * meses — servem apenas para os KPIs "Resultado Realizado" e "Saldo Final
 * Realizado" no Dashboard.
 */
import type { FinancialEntry, TypeClassification } from '@/types/financial';
import type { ProjectedEntry } from '@/lib/projectionEngine';
import type { PeriodClosureSnapshot, SnapshotPorTipo } from '@/hooks/usePeriodSnapshots';
import type { ModelItemRule } from '@/lib/ledgerEngine';
import {
  resolveEntryLedgerRule,
  resolveEntryTipoKey,
  normalizeTipo,
} from '@/lib/ledgerEngine';
import { resolveTipoMeta } from '@/lib/tipoMeta';

export type MovementSource = 'snapshot' | 'fluxo' | 'historico' | 'projecao' | 'vazio';
export type Classificacao = 'receita' | 'despesa' | 'operacao' | 'ignorar';
export type Sinal = 'somar' | 'subtrair';

export interface HistoricalRow {
  month: string; // YYYY-MM
  tipo_valor: string;
  valor: number;
}

export interface PorTipoAgg {
  key: string; // canonical
  label: string;
  classificacao: Classificacao;
  sinal: Sinal;
  isEntrada: boolean;
  entraNoResultado: boolean;
  impactaCaixa: boolean;
  valor: number; // valor absoluto (>= 0)
}

export interface MonthMovement {
  month: string;
  source: MovementSource;
  receitas: number; // >= 0
  despesas: number; // >= 0
  operacoesIn: number; // >= 0
  operacoesOut: number; // >= 0
  operacoesImpacto: number; // com sinal (+in, -out)
  saldoMovimento: number; // receitas - despesas + operacoesImpacto
  porTipo: PorTipoAgg[];
  /** Entries efetivamente considerados neste mês para movimentação de caixa. */
  entriesConsiderados: ProjectedEntry[];
  /** Mês com realizado parcial (fluxo importado + projeção após o corte). */
  parcial: boolean;
  /** Último dia com movimento realizado (quando `parcial`). */
  realizadoAte?: string;
  /**
   * Parcela já efetivamente realizada do mês (sem projeção). Uso exclusivo
   * para exibição nos KPIs "Realizado" — não participa da herança de saldo
   * entre meses (isso continua sendo feito por `saldoMovimento`).
   */
  receitasRealizadas: number;
  despesasRealizadas: number;
  saldoMovimentoRealizado: number;
}

export interface PeriodMovementCtx {
  entries: ProjectedEntry[]; // já vem de useProjectedEntries (com dataProjetada + impacto)
  historicalRows: HistoricalRow[]; // já filtrados pelo modelo se aplicável
  snapshotMap: Map<string, PeriodClosureSnapshot>;
  classifications: TypeClassification[];
  modelItems: ModelItemRule[];
  saldoInicialBase: number; // school.saldoInicial
  saldoInicialBaseDate?: string; // 'YYYY-MM-DD' (define o mês da âncora)
  todayStr?: string; // override para testes
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers puros
// ─────────────────────────────────────────────────────────────────────────────

const ORIGENS_NATIVAS = new Set(['sponte', 'cheque', 'cartao', 'contas_pagar']);

const ORIGEM_LABEL: Record<string, string> = {
  sponte: 'Receita (Sponte)',
  cheque: 'Receita (Cheques)',
  cartao: 'Receita (Cartões)',
  contas_pagar: 'Despesa (Contas a Pagar)',
};

export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/**
 * Decide a fonte oficial de movimentação do mês, sem misturar.
 */
export function resolveMonthSource(
  month: string,
  ctx: PeriodMovementCtx
): MovementSource {
  if (ctx.snapshotMap.has(month)) return 'snapshot';
  const monthEntries = ctx.entries.filter(e => monthOf(e.dataProjetada) === month);
  const hasFluxo = monthEntries.some(e => e.origem === 'fluxo');
  if (hasFluxo) return 'fluxo';
  const hasHist = ctx.historicalRows.some(r => r.month === month);
  if (hasHist) return 'historico';
  if (monthEntries.length > 0) return 'projecao';
  return 'vazio';
}

/**
 * Data de corte do realizado no mês: até ela vale o fluxo importado, depois
 * dela volta a valer a projeção. É o último dia com movimento de fluxo
 * importado (para meses já encerrados, o fim do mês).
 *
 * Importante: em mês ainda em aberto NÃO estendemos o corte até "hoje" —
 * o saldo final do mês precisa ser o SALDO PROJETADO (realizado até o corte
 * + previsão de todos os dias seguintes), pois é ele que será herdado como
 * saldo inicial do mês seguinte.
 */
export function computeFluxoCutoff(month: string, ctx: PeriodMovementCtx): string | undefined {
  let cutoff: string | undefined;
  for (const e of ctx.entries) {
    if (e.origem !== 'fluxo') continue;
    if (monthOf(e.dataProjetada) !== month) continue;
    if (!cutoff || e.dataProjetada > cutoff) cutoff = e.dataProjetada;
  }
  if (!cutoff) return undefined;

  const todayStr = ctx.todayStr ?? new Date().toISOString().slice(0, 10);
  const currentMonth = monthOf(todayStr);
  if (month < currentMonth) {
    // Mês já encerrado: o realizado cobre o mês inteiro.
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return `${month}-${String(lastDay).padStart(2, '0')}`;
  }
  return cutoff;
}

/**
 * Decide se uma entry participa da movimentação de caixa do seu mês,
 * dada a fonte oficial daquele mês. Nunca há sobreposição:
 * - fonte='fluxo'    → fluxo + manual até o corte + projeções APÓS o corte
 * - fonte='historico'→ apenas operações (histórico já cobre rec/desp)
 * - fonte='projecao' → tudo que não seja fluxo
 * - fonte='snapshot'/'vazio' → nada (snapshot vem congelado)
 */
export function includeEntryForMonth(
  entry: ProjectedEntry,
  source: MovementSource,
  todayStr: string,
  classifications: TypeClassification[],
  opts: { fluxoCutoff?: string } = {}
): boolean {
  if (source === 'fluxo') {
    // Mês parcialmente realizado: o fluxo importado manda até o último dia
    // com movimento (corte). Depois do corte, voltamos a usar a projeção —
    // assim nunca há soma duplicada no mesmo dia e o saldo final do mês já
    // reflete "realizado até X + previsão até o fim do mês".
    if (entry.origem === 'fluxo') return true;
    if (entry.origem === 'manual') return true;
    const cutoff = opts.fluxoCutoff;
    if (!cutoff) return false;
    return entry.dataProjetada > cutoff;
  }
  if (source === 'historico') {
    const rule = resolveEntryLedgerRule(entry, classifications);
    // Somente operações — histórico não consolida operações.
    return rule.impactaCaixa && !rule.entraNoResultado;
  }
  if (source === 'projecao') return entry.origem !== 'fluxo';
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Construção da movimentação de um mês
// ─────────────────────────────────────────────────────────────────────────────

function emptyMovement(month: string, source: MovementSource): MonthMovement {
  return {
    month,
    source,
    receitas: 0,
    despesas: 0,
    operacoesIn: 0,
    operacoesOut: 0,
    operacoesImpacto: 0,
    saldoMovimento: 0,
    porTipo: [],
    entriesConsiderados: [],
    parcial: false,
    receitasRealizadas: 0,
    despesasRealizadas: 0,
    saldoMovimentoRealizado: 0,
  };
}

function fromSnapshot(snap: PeriodClosureSnapshot, isInModel?: (l: string) => boolean): MonthMovement {
  let receitas = 0, despesas = 0, operacoesIn = 0, operacoesOut = 0;
  const porTipo: PorTipoAgg[] = [];
  for (const t of snap.por_tipo as SnapshotPorTipo[]) {
    if (t.classificacao === 'ignorar') continue;
    if (isInModel && !isInModel(t.label) && !isInModel(t.tipo)) continue;
    const v = Number(t.valor) || 0;
    if (t.classificacao === 'receita') receitas += v;
    else if (t.classificacao === 'despesa') despesas += v;
    else if (t.classificacao === 'operacao') {
      if (t.sinal === 'somar') operacoesIn += v;
      else operacoesOut += v;
    }
    porTipo.push({
      key: normalizeTipo(t.tipo),
      label: t.label,
      classificacao: t.classificacao,
      sinal: t.sinal,
      isEntrada: t.sinal === 'somar',
      entraNoResultado: t.classificacao === 'receita' || t.classificacao === 'despesa',
      impactaCaixa: true,
      valor: v,
    });
  }
  const operacoesImpacto = operacoesIn - operacoesOut;
  const saldoMovimento = receitas - despesas + operacoesImpacto;
  return {
    month: snap.month,
    source: 'snapshot',
    receitas, despesas, operacoesIn, operacoesOut, operacoesImpacto,
    saldoMovimento,
    porTipo,
    entriesConsiderados: [],
    parcial: false,
    // Snapshot é um mês fechado/congelado: 100% realizado.
    receitasRealizadas: receitas,
    despesasRealizadas: despesas,
    saldoMovimentoRealizado: saldoMovimento,
  };
}

/**
 * Construtor canônico. Nenhuma tela deve replicar essa lógica.
 */
export function buildMonthMovement(
  month: string,
  ctx: PeriodMovementCtx,
  opts: { isInModel?: (label: string) => boolean } = {}
): MonthMovement {
  const source = resolveMonthSource(month, ctx);
  if (source === 'vazio') return emptyMovement(month, source);
  if (source === 'snapshot') {
    const snap = ctx.snapshotMap.get(month)!;
    return fromSnapshot(snap, opts.isInModel);
  }

  const todayStr = ctx.todayStr ?? new Date().toISOString().slice(0, 10);
  const mov = emptyMovement(month, source);
  const fluxoCutoff = source === 'fluxo' ? computeFluxoCutoff(month, ctx) : undefined;
  mov.parcial = source === 'fluxo';
  mov.realizadoAte = fluxoCutoff;
  const byKey = new Map<string, PorTipoAgg>();
  let saldoDelta = 0; // acumula somente o que efetivamente impacta o caixa
  let saldoDeltaRealizado = 0; // idem, mas só a parcela já efetivamente realizada
  let receitasRealizadasAcc = 0;
  let despesasRealizadasAcc = 0;

  const ensureKey = (
    key: string,
    label: string,
    cls: Classificacao,
    sinal: Sinal,
    impactaCaixa: boolean,
  ): PorTipoAgg => {
    const k = normalizeTipo(key);
    let agg = byKey.get(k);
    if (!agg) {
      agg = {
        key: k, label,
        classificacao: cls, sinal,
        isEntrada: sinal === 'somar',
        entraNoResultado: cls === 'receita' || cls === 'despesa',
        impactaCaixa,
        valor: 0,
      };
      byKey.set(k, agg);
    }
    return agg;
  };

  // 1. Histórico (só quando source==='historico')
  // Mês histórico é sempre um mês encerrado — tratado como 100% realizado.
  if (source === 'historico') {
    for (const r of ctx.historicalRows) {
      if (r.month !== month) continue;
      const meta = resolveTipoMeta(r.tipo_valor, ctx.classifications, ctx.modelItems);
      if (meta.classificacao === 'ignorar') continue;
      const v = Number(r.valor) || 0;
      if (v === 0) continue;
      if (meta.classificacao === 'receita') { mov.receitas += v; receitasRealizadasAcc += v; }
      else if (meta.classificacao === 'despesa') { mov.despesas += v; despesasRealizadasAcc += v; }
      else if (meta.classificacao === 'operacao') {
        if (meta.sinal === 'somar') mov.operacoesIn += v;
        else mov.operacoesOut += v;
      }
      if (meta.impactaCaixa) {
        const delta = meta.sinal === 'somar' ? v : -v;
        saldoDelta += delta;
        saldoDeltaRealizado += delta;
      }
      const agg = ensureKey(r.tipo_valor, meta.label, meta.classificacao, meta.sinal, meta.impactaCaixa);
      agg.valor += v;
    }
  }

  // 2. Entries do mês
  const monthEntries = ctx.entries.filter(e => monthOf(e.dataProjetada) === month);
  for (const e of monthEntries) {
    if (!includeEntryForMonth(e, source, todayStr, ctx.classifications, { fluxoCutoff })) continue;
    const valor = Number(e.valor) || 0;
    if (valor === 0) continue;
    const isRealizado = (e as any).tipoRegistro === 'realizado';

    // Origens nativas de upload: classificação fixa pelo tipo, bucket próprio.
    if (ORIGENS_NATIVAS.has(e.origem)) {
      const isEntrada = e.tipo === 'entrada';
      const cls: Classificacao = isEntrada ? 'receita' : 'despesa';
      const sinal: Sinal = isEntrada ? 'somar' : 'subtrair';
      const bucketKey = `__${e.origem}_${e.tipo}`;
      const label = ORIGEM_LABEL[e.origem] ?? e.origem;
      const agg = ensureKey(bucketKey, label, cls, sinal, true);
      agg.valor += valor;
      if (isEntrada) mov.receitas += valor; else mov.despesas += valor;
      saldoDelta += isEntrada ? valor : -valor;
      if (isRealizado) {
        if (isEntrada) receitasRealizadasAcc += valor; else despesasRealizadasAcc += valor;
        saldoDeltaRealizado += isEntrada ? valor : -valor;
      }
      mov.entriesConsiderados.push(e);
      continue;
    }

    const rule = resolveEntryLedgerRule(e, ctx.classifications);
    if (!rule.impactaCaixa && !rule.entraNoResultado) continue; // ignorar
    const cls: Exclude<Classificacao, 'ignorar'> =
      rule.entraNoResultado
        ? (rule.operacaoSinal === 'somar' ? 'receita' : 'despesa')
        : 'operacao';
    const tipoKey = resolveEntryTipoKey(e, ctx.classifications);
    const label = rule.label || tipoKey;
    const agg = ensureKey(tipoKey, label, cls, rule.operacaoSinal, rule.impactaCaixa);
    agg.valor += valor;

    if (cls === 'receita') { mov.receitas += valor; if (isRealizado) receitasRealizadasAcc += valor; }
    else if (cls === 'despesa') { mov.despesas += valor; if (isRealizado) despesasRealizadasAcc += valor; }
    else if (cls === 'operacao') {
      if (rule.operacaoSinal === 'somar') mov.operacoesIn += valor;
      else mov.operacoesOut += valor;
    }
    if (rule.impactaCaixa) {
      const delta = rule.operacaoSinal === 'somar' ? valor : -valor;
      saldoDelta += delta;
      if (isRealizado) saldoDeltaRealizado += delta;
    }
    mov.entriesConsiderados.push(e);
  }

  mov.operacoesImpacto = mov.operacoesIn - mov.operacoesOut;
  mov.saldoMovimento = saldoDelta;
  mov.porTipo = Array.from(byKey.values());
  mov.receitasRealizadas = receitasRealizadasAcc;
  mov.despesasRealizadas = despesasRealizadasAcc;
  mov.saldoMovimentoRealizado = saldoDeltaRealizado;
  return mov;
}


// ─────────────────────────────────────────────────────────────────────────────
// Saldo Inicial / Saldo Final
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mês âncora efetivo. Preferimos `saldoInicialBaseDate` explícito da escola.
 * Se ausente, caímos para o mês mais antigo encontrado em qualquer fonte de
 * dados (entries, histórico, snapshots), garantindo que o Saldo Final não
 * fique "congelado" no Saldo Inicial quando a escola não tem data base
 * cadastrada — nesse caso o Saldo Inicial da escola representa o saldo
 * imediatamente anterior ao primeiro mês com dados.
 */
export function resolveAnchorMonth(ctx: PeriodMovementCtx): string | undefined {
  const explicit = ctx.saldoInicialBaseDate?.slice(0, 7);
  if (explicit) return explicit;
  let earliest: string | undefined;
  const consider = (m: string | undefined) => {
    if (!m) return;
    if (!earliest || m < earliest) earliest = m;
  };
  for (const e of ctx.entries) consider(monthOf(e.dataProjetada));
  for (const r of ctx.historicalRows) consider(r.month);
  for (const m of ctx.snapshotMap.keys()) consider(m);
  return earliest;
}

/**
 * Enumera os meses da âncora até `until` inclusive.
 * Aceita meses sem dados — o loop iterativo lida com "vazio" (movimento 0).
 */
function monthsFromBaseTo(baseMonth: string | undefined, until: string): string[] {
  if (!baseMonth || baseMonth > until) return [];
  const out: string[] = [];
  let m = baseMonth;
  while (m <= until) {
    out.push(m);
    m = nextMonth(m);
  }
  return out;
}

export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Saldo final acumulado ATÉ e INCLUINDO `month`.
 * Percorre da âncora ao mês alvo somando `saldoMovimento` de cada mês.
 * Se encontrar snapshot no caminho, usa `snapshot.saldo_final` como
 * novo ponto de partida (curto-circuito), garantindo que reabrir/fechar
 * um mês não desalinhe os saldos posteriores.
 */
export function computeSaldoFinal(
  month: string,
  ctx: PeriodMovementCtx,
  opts: { isInModel?: (label: string) => boolean } = {}
): number {
  const baseMonth = resolveAnchorMonth(ctx);
  const months = monthsFromBaseTo(baseMonth, month);
  if (months.length === 0) return ctx.saldoInicialBase;

  let saldo = ctx.saldoInicialBase;
  for (const m of months) {
    const snap = ctx.snapshotMap.get(m);
    if (snap) {
      saldo = snap.saldo_final;
      continue;
    }
    const mov = buildMonthMovement(m, ctx, opts);
    saldo += mov.saldoMovimento;
  }
  return saldo;
}

/**
 * Saldo inicial do mês = saldo final do mês anterior.
 */
export function computeSaldoInicial(
  month: string,
  ctx: PeriodMovementCtx,
  opts: { isInModel?: (label: string) => boolean } = {}
): number {
  const prev = prevMonth(month);
  const baseMonth = resolveAnchorMonth(ctx);
  // Se o mês anterior é anterior à âncora, saldo inicial === âncora.
  if (!baseMonth || prev < baseMonth) return ctx.saldoInicialBase;
  return computeSaldoFinal(prev, ctx, opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Saldo Inicial / Saldo Final — versão "Realizado" (somente exibição)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Versão paralela de `computeSaldoFinal` que soma apenas
 * `saldoMovimentoRealizado` de cada mês (sem a parcela projetada).
 *
 * IMPORTANTE: esta função é usada exclusivamente para exibição no Dashboard
 * (KPI "Saldo Final Realizado"). A herança de saldo entre meses continua
 * usando `computeSaldoFinal`/`computeSaldoInicial`, que não são alteradas.
 */
export function computeSaldoFinalRealizado(
  month: string,
  ctx: PeriodMovementCtx,
  opts: { isInModel?: (label: string) => boolean } = {}
): number {
  const baseMonth = resolveAnchorMonth(ctx);
  const months = monthsFromBaseTo(baseMonth, month);
  if (months.length === 0) return ctx.saldoInicialBase;

  let saldo = ctx.saldoInicialBase;
  for (const m of months) {
    const snap = ctx.snapshotMap.get(m);
    if (snap) {
      // Snapshot é um mês fechado — 100% realizado, mesmo valor da versão projetada.
      saldo = snap.saldo_final;
      continue;
    }
    const mov = buildMonthMovement(m, ctx, opts);
    saldo += mov.saldoMovimentoRealizado;
  }
  return saldo;
}

/**
 * Versão paralela de `computeSaldoInicial` para a visão "Realizado".
 */
export function computeSaldoInicialRealizado(
  month: string,
  ctx: PeriodMovementCtx,
  opts: { isInModel?: (label: string) => boolean } = {}
): number {
  const prev = prevMonth(month);
  const baseMonth = resolveAnchorMonth(ctx);
  if (!baseMonth || prev < baseMonth) return ctx.saldoInicialBase;
  return computeSaldoFinalRealizado(prev, ctx, opts);
}
