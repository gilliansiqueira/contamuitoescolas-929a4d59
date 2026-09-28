import type { BankAccount } from './bankCashflowEngine';

/** Só apresenta saldo bancário consolidado se TODAS as contas ativas têm extrato conferido na mesma data. */
export function confirmedBankBalance(accounts: BankAccount[]): { date: string; balance: number } | null {
  const active = accounts.filter(a => a.ativa);
  if (!active.length || active.some(a => !a.anchors?.length)) return null;
  const date = active[0].anchors?.[0]?.data;
  if (!date || active.some(a => a.anchors?.[0]?.data !== date)) return null;
  const cents = active.reduce((sum, a) => {
    const anchor = a.anchors?.[0];
    return sum + Math.round(Number(anchor?.saldo_conta ?? 0) * 100) + Math.round(Number(anchor?.saldo_aplicado ?? 0) * 100);
  }, 0);
  return { date, balance: cents / 100 };
}
/** Diferença pequena (rendimento/centavos) que fica "A confirmar no próximo extrato" sem bloquear. */
export const BANK_SMALL_DIFF_TOLERANCE = 15;
