/**
 * Conferência "a conta vencida saiu do extrato?" (só acompanhamento, sem
 * efeito em cálculos financeiros). Regras puras e testadas:
 *  1. vínculo manual da equipe (saída escolhida) quita a conta;
 *  2. saída conciliada com o mesmo item do modelo e valor próximo;
 *  3. saída de valor próximo entre 7 dias antes e 3 dias depois do vencimento
 *     (pagamento antecipado é comum);
 *  4. lote: várias contas do mesmo vencimento somando uma saída só;
 *  cada saída quita no máximo uma conta (ou um lote).
 * Tolerância: o maior entre R$ 20 e 3% do valor (juros/multa/desconto).
 */
export interface MatchPayable { key: string; valor: number; dueDate: string; categoriaKey: string }
export interface MatchOut { id: string; data: string; valor: number; itemKey: string | null }

export const ANTES_DIAS = 7;
export const DEPOIS_DIAS = 3;

export function tolerance(valor: number): number {
  return Math.max(20, Math.abs(valor) * 0.03);
}

export function addDaysIso(d: string, n: number): string {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

const inWindow = (tx: MatchOut, due: string) => tx.data >= addDaysIso(due, -ANTES_DIAS) && tx.data <= addDaysIso(due, DEPOIS_DIAS);
const near = (a: number, b: number) => Math.abs(a - b) <= tolerance(b);

/** Retorna as chaves das contas consideradas pagas. */
export function matchPayables(payables: MatchPayable[], outs: MatchOut[], manual: Map<string, string> = new Map()): Set<string> {
  const paid = new Set<string>();
  const used = new Set<string>();
  for (const p of payables) {
    const txId = manual.get(p.key);
    if (txId) { paid.add(p.key); used.add(txId); }
  }
  const pick = (p: MatchPayable, pred: (t: MatchOut) => boolean) => {
    const cands = outs.filter(t => !used.has(t.id) && inWindow(t, p.dueDate) && near(t.valor, p.valor) && pred(t))
      .sort((a, b) => Math.abs(a.valor - p.valor) - Math.abs(b.valor - p.valor));
    if (cands[0]) { used.add(cands[0].id); paid.add(p.key); }
  };
  const open = () => payables.filter(p => !paid.has(p.key));
  for (const p of open()) pick(p, t => !!t.itemKey && t.itemKey === p.categoriaKey);
  for (const p of open()) pick(p, () => true);
  // Lote: soma das contas restantes do mesmo vencimento.
  const byDue = new Map<string, MatchPayable[]>();
  for (const p of open()) byDue.set(p.dueDate, [...(byDue.get(p.dueDate) ?? []), p]);
  for (const [due, list] of byDue) {
    if (list.length < 2) continue;
    const total = list.reduce((s, p) => s + p.valor, 0);
    const tx = outs.find(t => !used.has(t.id) && inWindow(t, due) && near(t.valor, total));
    if (tx) { used.add(tx.id); list.forEach(p => paid.add(p.key)); }
  }
  return paid;
}

/** Saídas próximas para a equipe escolher qual pagou a conta. */
export function nearbyOuts(p: { valor: number; dueDate: string }, outs: MatchOut[], limit = 8): MatchOut[] {
  return outs.filter(t => inWindow(t, p.dueDate))
    .sort((a, b) => Math.abs(a.valor - p.valor) - Math.abs(b.valor - p.valor))
    .slice(0, limit);
}
