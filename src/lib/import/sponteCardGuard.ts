/**
 * Cartão do Sponte é só previsão. Onde já existem recebíveis reais da
 * maquininha (origem 'cartao'), o cartão do Sponte não pode coexistir:
 * descartamos as linhas de crédito/débito do Sponte até a última data
 * coberta pela maquininha (a partir da data inicial dela).
 */
const CARD_KEYS = new Set(['credito', 'debito']);

export interface CardGuardEntry { data: string; origem: string; tipo: string; payment_method_key?: string | null }

export function dropSponteCardCoveredByMaquininha<T extends CardGuardEntry>(
  sponte: T[],
  existing: CardGuardEntry[],
): { kept: T[]; dropped: T[]; ate: string | null } {
  const maq = existing.filter(e => e.origem === 'cartao' && e.tipo === 'entrada').map(e => e.data).sort();
  if (maq.length === 0) return { kept: sponte, dropped: [], ate: null };
  const de = maq[0], ate = maq[maq.length - 1];
  const kept: T[] = [], dropped: T[] = [];
  for (const e of sponte) {
    const isCard = e.tipo === 'entrada' && CARD_KEYS.has(String(e.payment_method_key ?? ''));
    if (isCard && e.data >= de && e.data <= ate) dropped.push(e);
    else kept.push(e);
  }
  return { kept, dropped, ate };
}
