/**
 * Sugestão de item do modelo para lançamentos do extrato, aprendida com o que a
 * equipe já conciliou (na própria empresa e, como apoio, na rede).
 * A sugestão só aponta um item do modelo; a classificação oficial continua sendo
 * a do item (SSOT) — nunca o sinal do valor.
 */
import { extractCounterparty } from '@/lib/bankStatements/counterparty';

export interface HistTx { descricao: string; tipo: string; itemId: string; valor?: number }
export interface Suggestion { itemId: string; count: number; total: number; share: number; source: 'empresa' | 'rede'; reliable: boolean }

/** Chave estável: contraparte (nome/CPF/CNPJ) ou o texto sem números. */
export function suggestKey(descricao: string, tipo: string): string {
  const cp = extractCounterparty(descricao);
  const base = cp || String(descricao ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/[^A-Z ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return `${tipo}|${base}`;
}

export type SuggestIndex = Map<string, Map<string, number>>;

export function buildIndex(hist: HistTx[]): SuggestIndex {
  const idx: SuggestIndex = new Map();
  for (const h of hist) {
    const k = suggestKey(h.descricao, h.tipo);
    if (k.endsWith('|')) continue;
    const m = idx.get(k) ?? new Map<string, number>();
    m.set(h.itemId, (m.get(h.itemId) ?? 0) + 1);
    idx.set(k, m);
  }
  return idx;
}

/** Confiável = 3+ conciliações iguais e nenhuma divergente. */
export const MIN_RELIABLE = 3;

export function suggest(tx: { descricao: string; tipo: string }, own: SuggestIndex, network?: SuggestIndex): Suggestion | null {
  const k = suggestKey(tx.descricao, tx.tipo);
  for (const [src, idx] of [['empresa', own], ['rede', network]] as const) {
    const m = idx?.get(k);
    if (!m?.size) continue;
    const total = [...m.values()].reduce((s, n) => s + n, 0);
    const [itemId, count] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    const share = count / total;
    return { itemId, count, total, share, source: src, reliable: src === 'empresa' && count >= MIN_RELIABLE && share === 1 };
  }
  return null;
}
