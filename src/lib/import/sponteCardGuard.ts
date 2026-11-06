/**
 * Cartão no Sponte = aluno que AINDA NÃO passou o cartão (a receber).
 * Cartão da maquininha (origem 'cartao') = cartão JÁ passado.
 * São pessoas diferentes: um relatório nunca apaga o outro. Aqui só
 * apontamos possíveis duplicidades (mesmo valor no mesmo mês) para conferência.
 */
const CARD_KEYS = new Set(['credito', 'debito']);

export interface CardGuardEntry { data: string; origem: string; tipo: string; valor?: number; payment_method_key?: string | null }

export function isSponteCard(e: CardGuardEntry): boolean {
  return e.tipo === 'entrada' && CARD_KEYS.has(String(e.payment_method_key ?? ''));
}

export function summarizeSponteVsMaquininha<T extends CardGuardEntry>(
  sponte: T[],
  existing: CardGuardEntry[],
): { kept: T[]; sponteCard: { n: number; total: number }; maquininha: { n: number; total: number }; suspects: T[] } {
  const maq = existing.filter(e => e.origem === 'cartao' && e.tipo === 'entrada');
  const keys = new Map<string, number>();
  for (const m of maq) {
    const k = `${m.data.slice(0, 7)}|${Math.round(Math.abs(m.valor ?? 0) * 100)}`;
    keys.set(k, (keys.get(k) ?? 0) + 1);
  }
  const cards = sponte.filter(isSponteCard);
  const suspects: T[] = [];
  for (const e of cards) {
    const k = `${e.data.slice(0, 7)}|${Math.round(Math.abs(e.valor ?? 0) * 100)}`;
    const n = keys.get(k) ?? 0;
    if (n > 0) { suspects.push(e); keys.set(k, n - 1); }
  }
  const sum = (a: CardGuardEntry[]) => a.reduce((s, e) => s + Math.abs(e.valor ?? 0), 0);
  return {
    kept: sponte,
    sponteCard: { n: cards.length, total: sum(cards) },
    maquininha: { n: maq.length, total: sum(maq) },
    suspects,
  };
}
