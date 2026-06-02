import type { FinancialEntry, TypeClassification } from '@/types/financial';
import {
  normalizeTipo,
  resolveLedgerRule,
  resolveEntryLedgerRule,
  getLedgerSaldoImpact,
  processLedger,
  DEFAULT_MAPPINGS
} from './ledgerEngine';

export type EffectiveClassification = 'receita' | 'despesa' | 'operacao' | 'ignorar';
export type OperacaoSinal = 'somar' | 'subtrair';

export { normalizeTipo };

/**
 * Normalização única canônica.
 */
export function getCanonicalKey(rawTipo: string): string {
  return normalizeTipo(rawTipo);
}

export function getCanonicalLabel(rawTipo: string): string {
  return rawTipo;
}

/**
 * Mapeamento de retrocompatibilidade para as telas antigas que esperam
 * classificações de texto ('receita', 'despesa', 'operacao', 'ignorar').
 * 
 * Deriva essa classificação diretamente das propriedades do Ledger Engine.
 */
/**
 * Resolve a regra do ledger tentando, em ordem:
 *   tipoOriginal → categoria → tipo
 * Garante que entries projetadas (cujo `tipoOriginal` é vazio e a
 * configuração de "Ignorar" foi feita pelo nome da categoria, ex.
 * "Material Didático") sejam corretamente classificadas e filtradas.
 */
function resolveEffectiveRule(
  entry: FinancialEntry,
  classifications: TypeClassification[]
) {
  // Delega ao motor central, que percorre tipoOriginal → categoria → tipo
  // e considera type_classifications + DEFAULT_MAPPINGS (ex.: 'saida'/'entrada').
  // Isso evita que entries projetadas (tipoOriginal vazio, categoria como
  // "Internet", "INSS" etc.) caiam no fallback de regra zerada e sejam
  // erroneamente classificadas como 'ignorar'.
  return resolveEntryLedgerRule(entry, classifications);
}

export function getEffectiveClassification(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): EffectiveClassification {
  if (entry.editadoManualmente) {
    return entry.tipo === 'entrada' ? 'receita' : 'despesa';
  }

  const rule = resolveEffectiveRule(entry, classifications);
  if (!rule.impactaCaixa && !rule.entraNoResultado) return 'ignorar';
  if (rule.entraNoResultado) {
    return rule.operacaoSinal === 'somar' ? 'receita' : 'despesa';
  }
  return 'operacao';
}

export function isEntryIgnored(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): boolean {
  return getEffectiveClassification(entry, classifications) === 'ignorar';
}

export function countsInResultado(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): boolean {
  const cls = getEffectiveClassification(entry, classifications);
  return cls === 'receita' || cls === 'despesa';
}

export function isReceita(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): boolean {
  return getEffectiveClassification(entry, classifications) === 'receita';
}

export function isDespesa(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): boolean {
  return getEffectiveClassification(entry, classifications) === 'despesa';
}

export function isOperacao(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): boolean {
  return getEffectiveClassification(entry, classifications) === 'operacao';
}

/**
 * Retorna o sinal efetivo para a UI.
 */
export function getEffectiveSinal(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): OperacaoSinal {
  if (entry.editadoManualmente) {
    return entry.tipo === 'entrada' ? 'somar' : 'subtrair';
  }

  const rule = resolveEffectiveRule(entry, classifications);
  return rule.operacaoSinal;
}

/**
 * Retorna o impacto no saldo delegando inteiramente para o Ledger Engine.
 */
export function getSaldoImpact(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): number {
  return getLedgerSaldoImpact(entry, classifications);
}

export function filterActiveEntries(
  entries: FinancialEntry[],
  classifications: TypeClassification[]
): FinancialEntry[] {
  return entries.filter(e => !isEntryIgnored(e, classifications));
}

/**
 * Função de soma unificada para views legadas — consome 100% o ledgerEngine.
 */
export function calculateTotals(
  entries: FinancialEntry[],
  classifications: TypeClassification[]
) {
  return processLedger(entries, classifications);
}
export function defaultSinalFor(cls: EffectiveClassification): OperacaoSinal {
  return cls === 'despesa' ? 'subtrair' : 'somar';
}
export function findClassification(
  rawTipo: string,
  classifications: TypeClassification[]
): TypeClassification | null {
  const n = normalizeTipo(rawTipo);
  return classifications.find(c => normalizeTipo(c.tipoValor) === n) ?? null;
}
export function classifyTipoName(
  rawTipo: string,
  classifications: TypeClassification[]
): EffectiveClassification | null {
  const cls = getEffectiveClassification(
    { tipoOriginal: rawTipo, tipo: 'entrada' } as any,
    classifications
  );
  return cls;
}
