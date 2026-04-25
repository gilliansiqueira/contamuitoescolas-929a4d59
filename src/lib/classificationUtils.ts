/**
 * Shared classification logic — SINGLE SOURCE OF TRUTH
 *
 * Modelo (decidido pelo usuário, sem heurísticas por nome):
 *   1) Toda entry tem uma TypeClassification configurada pelo usuário:
 *        - classificacao: 'receita' | 'despesa' | 'operacao' | 'ignorar'
 *        - operacaoSinal: 'somar' | 'subtrair'  (obrigatório p/ tudo exceto 'ignorar')
 *   2) Override manual (editadoManualmente=true) usa entry.tipo como fallback.
 *   3) Sem mapeamento de sinônimos por nome — a configuração do usuário manda.
 *
 * Resultado:
 *   - 'receita'  → entra no resultado (+) e impacta saldo segundo operacaoSinal
 *   - 'despesa'  → entra no resultado (−) e impacta saldo segundo operacaoSinal
 *   - 'operacao' → NÃO entra no resultado, impacta saldo segundo operacaoSinal
 *   - 'ignorar'  → não entra em nada
 */

import type { FinancialEntry, TypeClassification } from '@/types/financial';

export type EffectiveClassification = 'receita' | 'despesa' | 'operacao' | 'ignorar';
export type OperacaoSinal = 'somar' | 'subtrair';

/**
 * Normalização canônica para comparação de tipos:
 *  - lowercase, trim, colapsa espaços
 *  - remove acentos/diacríticos (NFD)
 * Apenas para casar variações de escrita do mesmo "tipo" ao buscar
 * configuração do usuário — NÃO inferimos classificação a partir do nome.
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

function normalize(s: string): string {
  return normalizeTipo(s);
}

/**
 * Chave canônica usada em agregações por nome de tipo.
 * Apenas normaliza (não aplica sinônimos).
 */
export function getCanonicalKey(rawTipo: string): string {
  return normalize(rawTipo);
}

export function getCanonicalLabel(rawTipo: string): string {
  return rawTipo;
}

/**
 * Sugere o sinal padrão para uma classificação.
 * - receita  → somar
 * - despesa  → subtrair
 * - operacao → somar (usuário pode trocar)
 * - ignorar  → somar (irrelevante)
 */
export function defaultSinalFor(cls: EffectiveClassification): OperacaoSinal {
  return cls === 'despesa' ? 'subtrair' : 'somar';
}

/**
 * Localiza a configuração do usuário para um nome de tipo (por chave normalizada).
 */
export function findClassification(
  rawTipo: string,
  classifications: TypeClassification[]
): TypeClassification | null {
  const n = normalize(rawTipo);
  return classifications.find(c => normalize(c.tipoValor) === n) ?? null;
}

/**
 * Classifica APENAS pela tabela de configurações do usuário.
 * Sem sinônimos, sem heurística por nome.
 */
export function classifyTipoName(
  rawTipo: string,
  classifications: TypeClassification[]
): EffectiveClassification | null {
  const cfg = findClassification(rawTipo, classifications);
  return (cfg?.classificacao as EffectiveClassification) ?? null;
}

/**
 * Classificação efetiva de uma entry.
 *
 * Ordem:
 *  1) Entry editada manualmente → usa entry.tipo (entrada=receita, saida=despesa)
 *  2) TypeClassification do usuário (lookup pelo nome do tipo)
 *  3) Fallback final (sem config): mapeia entry.tipo (entrada=receita, saida=despesa)
 *     — NÃO inferimos por nome do tipo.
 */
export function getEffectiveClassification(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): EffectiveClassification {
  if (entry.editadoManualmente) {
    return entry.tipo === 'entrada' ? 'receita' : 'despesa';
  }

  if (entry.origem === 'fluxo') {
    const tipoKey = entry.tipoOriginal || entry.tipo;
    const fromConfig = classifyTipoName(tipoKey, classifications);
    if (fromConfig) return fromConfig;
  }

  // Sem configuração: usa o sinal explícito da entry (entrada/saida).
  return entry.tipo === 'entrada' ? 'receita' : 'despesa';
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
 * Sinal efetivo para impacto no saldo. Sempre 'somar' ou 'subtrair'.
 * - Para 'ignorar': retorna 'somar' (irrelevante; impacto será 0).
 * - Caso a config tenha 'auto' (legado), resolve para o default da classificação.
 */
export function getEffectiveSinal(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): OperacaoSinal {
  const cls = getEffectiveClassification(entry, classifications);
  if (cls === 'ignorar') return 'somar';

  const cfg = !entry.editadoManualmente && entry.origem === 'fluxo'
    ? findClassification(entry.tipoOriginal || entry.tipo, classifications)
    : null;

  const raw = cfg?.operacaoSinal;
  if (raw === 'somar' || raw === 'subtrair') return raw;
  // 'auto' (legado) ou ausente → default por classificação
  return defaultSinalFor(cls);
}

/**
 * Impacto no saldo: + ou - conforme sinal definido pelo usuário.
 * 'ignorar' → 0.
 */
export function getSaldoImpact(
  entry: FinancialEntry,
  classifications: TypeClassification[]
): number {
  const cls = getEffectiveClassification(entry, classifications);
  if (cls === 'ignorar') return 0;
  const sinal = getEffectiveSinal(entry, classifications);
  return sinal === 'somar' ? entry.valor : -entry.valor;
}

export function filterActiveEntries(
  entries: FinancialEntry[],
  classifications: TypeClassification[]
): FinancialEntry[] {
  return entries.filter(e => !isEntryIgnored(e, classifications));
}

/**
 * Totais com base na nova regra:
 *   resultado = receitas - despesas
 *   saldoMovimento = soma de getSaldoImpact (já respeita sinal)
 */
export function calculateTotals(
  entries: FinancialEntry[],
  classifications: TypeClassification[]
) {
  let receitas = 0;
  let despesas = 0;
  let operacoesIn = 0;
  let operacoesOut = 0;
  let saldoMovimento = 0;

  for (const e of entries) {
    const cls = getEffectiveClassification(e, classifications);
    if (cls === 'ignorar') continue;

    const impact = getSaldoImpact(e, classifications);
    saldoMovimento += impact;

    if (cls === 'receita') receitas += e.valor;
    else if (cls === 'despesa') despesas += e.valor;
    else if (cls === 'operacao') {
      if (impact >= 0) operacoesIn += impact;
      else operacoesOut += Math.abs(impact);
    }
  }

  return {
    receitas,
    despesas,
    resultado: receitas - despesas,
    operacoesIn,
    operacoesOut,
    saldoMovimento,
  };
}
