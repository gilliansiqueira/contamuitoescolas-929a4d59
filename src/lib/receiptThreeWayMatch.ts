/**
 * Cruzamento triplo dos recebimentos: previsão (Sponte/Omni) → repasse da
 * maquininha → entrada no banco. Puro e testado; só liga lançamentos, não
 * recalcula receitas (os valores vêm da SSOT/importações).
 *
 * - Cartão: repasse da maquininha ↔ depósito (individual ou soma do dia), até 2 dias úteis.
 * - Boleto/PIX: previsão ↔ depósito (individual ou soma do dia), até 2 dias úteis.
 * - Previsão de cartão ↔ repasse: comparada por mês (o repasse não traz aluno).
 * Cada depósito é usado uma única vez.
 */
export interface Expected { id: string; date: string; valor: number; kind: 'cartao' | 'boleto_pix' }
export interface Deposit { id: string; date: string; valor: number; descricao?: string }

export type MatchStatus = 'fechou' | 'sem_deposito';
export interface ExpectedResult { date: string; kind: Expected['kind']; total: number; ids: string[]; depositIds: string[]; status: MatchStatus; diferenca: number }
export interface ThreeWayResult {
  matched: ExpectedResult[];
  missing: ExpectedResult[];
  unexpectedDeposits: Deposit[];
  cardForecastTotal: number;
  cardSettlementTotal: number;
}

export const tol = (v: number) => Math.max(0.05, Math.abs(v) * 0.005);

export function addBusinessDays(d: string, n: number): string {
  const x = new Date(`${d}T12:00:00Z`);
  let left = n;
  while (left > 0) {
    x.setUTCDate(x.getUTCDate() + 1);
    const w = x.getUTCDay();
    if (w !== 0 && w !== 6) left--;
  }
  return x.toISOString().slice(0, 10);
}

const inWin = (dep: Deposit, date: string) => dep.date >= date && dep.date <= addBusinessDays(date, 2);
const near = (a: number, b: number) => Math.abs(a - b) <= tol(b);

export function threeWayMatch(expected: Expected[], deposits: Deposit[], cardForecastTotal = 0): ThreeWayResult {
  const used = new Set<string>();
  const done = new Set<string>();
  const matched: ExpectedResult[] = [];
  const res = (list: Expected[], deps: Deposit[]): ExpectedResult => {
    const total = list.reduce((s, e) => s + e.valor, 0);
    const got = deps.reduce((s, d) => s + d.valor, 0);
    return { date: list[0].date, kind: list[0].kind, total, ids: list.map(e => e.id), depositIds: deps.map(d => d.id), status: deps.length ? 'fechou' : 'sem_deposito', diferenca: deps.length ? +(got - total).toFixed(2) : -total };
  };
  // 1) individual
  for (const e of [...expected].sort((a, b) => a.date.localeCompare(b.date))) {
    const d = deposits.filter(x => !used.has(x.id) && inWin(x, e.date) && near(x.valor, e.valor))
      .sort((a, b) => a.date.localeCompare(b.date) || Math.abs(a.valor - e.valor) - Math.abs(b.valor - e.valor))[0];
    if (d) { used.add(d.id); done.add(e.id); matched.push(res([e], [d])); }
  }
  // 2) soma do dia (por tipo) ↔ um depósito, ou ↔ soma dos depósitos de um dia
  const groups = new Map<string, Expected[]>();
  for (const e of expected) if (!done.has(e.id)) groups.set(`${e.date}|${e.kind}`, [...(groups.get(`${e.date}|${e.kind}`) ?? []), e]);
  const missing: ExpectedResult[] = [];
  for (const list of groups.values()) {
    const total = list.reduce((s, e) => s + e.valor, 0);
    const date = list[0].date;
    const free = deposits.filter(x => !used.has(x.id) && inWin(x, date));
    let deps: Deposit[] = [];
    const one = free.find(x => near(x.valor, total));
    if (one) deps = [one];
    else {
      const byDay = new Map<string, Deposit[]>();
      for (const x of free) byDay.set(x.date, [...(byDay.get(x.date) ?? []), x]);
      for (const ds of byDay.values()) if (ds.length > 1 && near(ds.reduce((s, x) => s + x.valor, 0), total)) { deps = ds; break; }
    }
    deps.forEach(x => used.add(x.id));
    const r = res(list, deps);
    (deps.length ? matched : missing).push(r);
  }
  const cardSettlementTotal = expected.filter(e => e.kind === 'cartao').reduce((s, e) => s + e.valor, 0);
  return {
    matched: matched.sort((a, b) => a.date.localeCompare(b.date)),
    missing: missing.sort((a, b) => a.date.localeCompare(b.date)),
    unexpectedDeposits: deposits.filter(x => !used.has(x.id)).sort((a, b) => a.date.localeCompare(b.date)),
    cardForecastTotal,
    cardSettlementTotal,
  };
}
