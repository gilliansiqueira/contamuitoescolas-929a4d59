import type { BankAccount } from './bankCashflowEngine';

/**
 * Só apresenta saldo bancário consolidado se TODAS as contas ativas têm extrato conferido
 * na mesma data. Com allowStaleSporadic, contas "extrato esporádico" podem ficar com a
 * âncora do último extrato recebido: o saldo vale o do último extrato até chegar outro.
 */
export function confirmedBankBalance(
  accounts: BankAccount[],
  opts?: { allowStaleSporadic?: boolean },
): { date: string; balance: number } | null {
  const active = accounts.filter(a => a.ativa);
  if (!active.length || active.some(a => !a.anchors?.length)) return null;
  const anchorDates = active.map(a => a.anchors?.[0]?.data ?? '');
  const allowStale = !!opts?.allowStaleSporadic;
  const date = allowStale ? [...anchorDates].sort().at(-1) : anchorDates[0];
  if (!date || (!allowStale && anchorDates.some(d => d !== date))) return null;
  const cents = active.reduce((sum, a) => {
    const anchor = a.anchors?.[0];
    return sum + Math.round(Number(anchor?.saldo_conta ?? 0) * 100) + Math.round(Number(anchor?.saldo_aplicado ?? 0) * 100);
  }, 0);
  return { date, balance: cents / 100 };
}
/** Diferença pequena (rendimento/centavos) que fica "A confirmar no próximo extrato" sem bloquear. */
export const BANK_SMALL_DIFF_TOLERANCE = 20;
