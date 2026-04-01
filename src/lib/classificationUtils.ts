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

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Get the effective classification for an entry.
 * Uses TypeClassification table for fluxo entries, falls back to tipo field.
 */
export function getEffectiveClassification(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): EffectiveClassification {
  // For fluxo entries, check TypeClassification table first
  if (entry.origem === 'fluxo' && !entry.editadoManualmente) {
    const tipoKey = entry.tipoOriginal || entry.tipo;
    const cls = classifications.find(c => normalize(c.tipoValor) === normalize(tipoKey));
    if (cls) {
      return cls.classificacao as EffectiveClassification;
    }
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
 * Operacao entries still affect saldo based on their tipo field.
 * Ignorar entries have zero impact.
 */
export function getSaldoImpact(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): number {
  const cls = getEffectiveClassification(entry, classifications);
  if (cls === 'ignorar') return 0;
  // For saldo: receita/operacao with tipo=entrada add, despesa/operacao with tipo=saida subtract
  if (entry.tipo === 'entrada') return entry.valor;
  return -entry.valor;
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
      if (e.tipo === 'entrada') operacoesIn += e.valor;
      else operacoesOut += e.valor;
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
