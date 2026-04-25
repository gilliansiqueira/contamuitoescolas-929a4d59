/**
 * Shared classification logic — SINGLE SOURCE OF TRUTH
 * 
 * Priority:
 *   1) Manual edit (editadoManualmente = true) → use entry.tipo as-is
 *   2) TypeClassification table (user config per school)
 *   3) Entry's tipo field (entrada/saida)
 * 
 * Effective classification:
 *   'receita'  → counts in resultado, sums as entrada
 *   'despesa'  → counts in resultado, sums as saida
 *   'operacao' → does NOT count in resultado, but DOES affect saldo
 *   'ignorar'  → excluded from all calculations
 */

import type { FinancialEntry, TypeClassification } from '@/types/financial';

export type EffectiveClassification = 'receita' | 'despesa' | 'operacao' | 'ignorar';

/**
 * Normalização canônica para comparação de tipos:
 *  - lowercase
 *  - trim + colapsa espaços internos
 *  - remove acentos/diacríticos (NFD)
 * Use SEMPRE esta função antes de comparar/agrupar tipos.
 * Ex.: "Saída ", "saida", "SAÍDA" → "saida"
 */
export function normalizeTipo(s: string): string {
  if (!s) return '';
  return s
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Backward-compat alias used internamente neste arquivo
function normalize(s: string): string {
  return normalizeTipo(s);
}

/**
 * Mapa canônico de sinônimos → classificação fixa.
 * Chaves SEMPRE em formato normalizado (sem acento, lowercase).
 * Garante que "Saída", "saidas", "despesas" virem 'despesa',
 * e "entrada", "entradas", "receitas" virem 'receita' — evitando KPIs duplicados.
 */
const SYNONYM_TO_CLASSIFICATION: Record<string, EffectiveClassification> = {
  receita: 'receita',
  receitas: 'receita',
  entrada: 'receita',
  entradas: 'receita',
  despesa: 'despesa',
  despesas: 'despesa',
  saida: 'despesa',
  saidas: 'despesa',
};

/**
 * Chave canônica usada em agregações (ex: "despesa" e "despesas" => mesmo bucket).
 * Mantém o nome original para exibição via `getCanonicalLabel`.
 */
export function getCanonicalKey(rawTipo: string): string {
  const n = normalize(rawTipo);
  const cls = SYNONYM_TO_CLASSIFICATION[n];
  if (cls === 'receita') return 'receita';
  if (cls === 'despesa') return 'despesa';
  return n;
}

export function getCanonicalLabel(rawTipo: string): string {
  const n = normalize(rawTipo);
  const cls = SYNONYM_TO_CLASSIFICATION[n];
  if (cls === 'receita') return 'Receita';
  if (cls === 'despesa') return 'Despesa';
  return rawTipo;
}

/**
 * Classifica um nome de tipo (sinônimo ou customizado) usando o mapa canônico
 * antes de cair na tabela de TypeClassification.
 */
export function classifyTipoName(
  rawTipo: string,
  classifications: TypeClassification[]
): EffectiveClassification | null {
  const n = normalize(rawTipo);
  const synonym = SYNONYM_TO_CLASSIFICATION[n];
  if (synonym) return synonym;
  const cls = classifications.find(c => normalize(c.tipoValor) === n);
  if (cls) return cls.classificacao as EffectiveClassification;
  return null;
}

/**
 * Get the effective classification for an entry.
 * Uses TypeClassification table for fluxo entries, falls back to tipo field.
 */
export function getEffectiveClassification(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): EffectiveClassification {
  // For fluxo entries, check TypeClassification table first (with synonym fallback)
  if (entry.origem === 'fluxo' && !entry.editadoManualmente) {
    const tipoKey = entry.tipoOriginal || entry.tipo;
    const resolved = classifyTipoName(tipoKey, classifications);
    if (resolved) return resolved;
  }

  // For non-fluxo entries or when no classification found, use tipo field
  if (entry.tipo === 'entrada') return 'receita';
  if (entry.tipo === 'saida') return 'despesa';
  return 'operacao';
}

/**
 * Check if entry should be completely excluded from all calculations
 */
export function isEntryIgnored(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): boolean {
  return getEffectiveClassification(entry, classifications) === 'ignorar';
}

/**
 * Check if entry counts toward resultado (receitas - despesas)
 * Only receita and despesa count. Operacao does NOT.
 */
export function countsInResultado(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): boolean {
  const cls = getEffectiveClassification(entry, classifications);
  return cls === 'receita' || cls === 'despesa';
}

/**
 * Check if entry is effectively an entrada (for resultado calculation)
 */
export function isReceita(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): boolean {
  return getEffectiveClassification(entry, classifications) === 'receita';
}

/**
 * Check if entry is effectively a saida (for resultado calculation)
 */
export function isDespesa(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): boolean {
  return getEffectiveClassification(entry, classifications) === 'despesa';
}

/**
 * Check if entry is an operation (affects saldo but NOT resultado)
 */
export function isOperacao(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): boolean {
  return getEffectiveClassification(entry, classifications) === 'operacao';
}

/**
 * Get the saldo impact of an entry (positive = money in, negative = money out)
 * - 'ignorar'  → zero
 * - 'receita'  → +valor (money in)
 * - 'despesa'  → -valor (money out)
 * - 'operacao' → respeita o `operacaoSinal` configurado:
 *      • 'somar'    → +valor
 *      • 'subtrair' → -valor
 *      • 'auto'     → segue o tipo do lançamento (entrada=+, saida=-)
 */
export function getSaldoImpact(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): number {
  const cls = getEffectiveClassification(entry, classifications);
  if (cls === 'ignorar') return 0;
  if (cls === 'receita') return entry.valor;
  if (cls === 'despesa') return -entry.valor;
  // operacao: usa configuração explícita quando existir
  if (entry.origem === 'fluxo' && !entry.editadoManualmente) {
    const tipoKey = entry.tipoOriginal || entry.tipo;
    const cfg = classifications.find(
      c => c.tipoValor.toLowerCase().trim() === tipoKey.toLowerCase().trim()
    );
    if (cfg?.classificacao === 'operacao') {
      if (cfg.operacaoSinal === 'somar') return entry.valor;
      if (cfg.operacaoSinal === 'subtrair') return -entry.valor;
    }
  }
  // fallback 'auto' → segue o tipo do lançamento
  return entry.tipo === 'entrada' ? entry.valor : -entry.valor;
}

/**
 * Filter entries removing ignored ones
 */
export function filterActiveEntries(
  entries: FinancialEntry[],
  classifications: TypeClassification[]
): FinancialEntry[] {
  return entries.filter(e => !isEntryIgnored(e, classifications));
}

/**
 * Calculate totals with proper classification logic
 */
export function calculateTotals(
  entries: FinancialEntry[],
  classifications: TypeClassification[]
) {
  let receitas = 0;
  let despesas = 0;
  let operacoesIn = 0;
  let operacoesOut = 0;

  for (const e of entries) {
    const cls = getEffectiveClassification(e, classifications);
    if (cls === 'ignorar') continue;
    if (cls === 'receita') receitas += e.valor;
    else if (cls === 'despesa') despesas += e.valor;
    else if (cls === 'operacao') {
      // Respeita o sinal configurado para operação
      const impact = getSaldoImpact(e, classifications);
      if (impact >= 0) operacoesIn += Math.abs(impact);
      else operacoesOut += Math.abs(impact);
    }
  }

  return {
    receitas,
    despesas,
    resultado: receitas - despesas,
    operacoesIn,
    operacoesOut,
    saldoMovimento: receitas - despesas + operacoesIn - operacoesOut,
  };
}
