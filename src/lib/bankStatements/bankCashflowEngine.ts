/**
 * Cálculos do piloto de Fluxo Bancário. A situação de conciliação NUNCA
 * entra nos saldos: todo lançamento realizado conta, pendente ou não.
 */
export type ReconStatus = 'pendente' | 'conciliado' | 'nao_se_aplica';

export interface BankAccount {
  id: string;
  nome: string;
  banco: string;
  agencia: string | null;
  conta: string | null;
  saldo_inicial: number;
  saldo_inicial_data: string | null;
  ativa: boolean;
}

export interface BankTx {
  id: string;
  account_id: string;
  import_id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  transfer_pair_id: string | null;
  recon_status: ReconStatus;
  recon_by_email: string | null;
  recon_at: string | null;
  recon_note: string | null;
  created_at: string;
}

export const signed = (t: Pick<BankTx, 'valor' | 'tipo'>) => (t.tipo === 'entrada' ? Number(t.valor) : -Number(t.valor));

/** Lançamentos anteriores ou iguais à data do saldo inicial já estão contidos nele. */
export const countsForAccount = (acc: BankAccount, t: BankTx) =>
  !acc.saldo_inicial_data || t.data > acc.saldo_inicial_data;

export function accountBalance(acc: BankAccount, txs: BankTx[], upTo: string): number {
  let s = Number(acc.saldo_inicial) || 0;
  for (const t of txs) if (t.account_id === acc.id && t.data <= upTo && countsForAccount(acc, t)) s += signed(t);
  return Math.round(s * 100) / 100;
}

export function lastDateByAccount(txs: BankTx[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of txs) if (!m.has(t.account_id) || t.data > m.get(t.account_id)!) m.set(t.account_id, t.data);
  return m;
}

export interface PilotSummary {
  saldoAtual: number;
  entradasRealizadas: number;
  saidasRealizadas: number;
  transferenciasInternas: number;
  pendentesQtd: number;
  pendentesValor: number;
  percentConciliado: number;
}

/** Transferências entre contas próprias (par confirmado) ficam fora de entradas/saídas. */
export function summarize(accounts: BankAccount[], txs: BankTx[], from: string, to: string, today: string): PilotSummary {
  const accMap = new Map(accounts.map(a => [a.id, a]));
  let entradas = 0, saidas = 0, transf = 0, pendQ = 0, pendV = 0, resolved = 0, total = 0;
  for (const t of txs) {
    const acc = accMap.get(t.account_id);
    if (!acc || t.data < from || t.data > to) continue;
    total++;
    if (t.recon_status === 'pendente') { pendQ++; pendV += Number(t.valor); } else resolved++;
    if (!countsForAccount(acc, t)) continue;
    if (t.transfer_pair_id) { transf += Number(t.valor); continue; }
    if (t.tipo === 'entrada') entradas += Number(t.valor); else saidas += Number(t.valor);
  }
  const saldoAtual = accounts.reduce((s, a) => s + accountBalance(a, txs, today), 0);
  return {
    saldoAtual: Math.round(saldoAtual * 100) / 100,
    entradasRealizadas: entradas,
    saidasRealizadas: saidas,
    transferenciasInternas: transf / 2,
    pendentesQtd: pendQ,
    pendentesValor: pendV,
    percentConciliado: total ? (resolved / total) * 100 : 0,
  };
}

/** Saldo corrente linha a linha (por conta ou consolidado), em ordem de data/importação. */
export function runningBalances(accounts: BankAccount[], txs: BankTx[], accountId: string | 'all'): Map<string, number> {
  const accs = accounts.filter(a => accountId === 'all' || a.id === accountId);
  const accMap = new Map(accs.map(a => [a.id, a]));
  let s = accs.reduce((acc, a) => acc + (Number(a.saldo_inicial) || 0), 0);
  const out = new Map<string, number>();
  const sorted = txs.filter(t => accMap.has(t.account_id)).sort((a, b) => a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  for (const t of sorted) {
    if (countsForAccount(accMap.get(t.account_id)!, t)) s += signed(t);
    out.set(t.id, Math.round(s * 100) / 100);
  }
  return out;
}

/** Sugere pares de transferência: mesmo valor, sentidos opostos, contas diferentes, até 2 dias. */
export function suggestTransferPairs(txs: BankTx[]): [BankTx, BankTx][] {
  const free = txs.filter(t => !t.transfer_pair_id);
  const saidas = free.filter(t => t.tipo === 'saida');
  const used = new Set<string>();
  const pairs: [BankTx, BankTx][] = [];
  const dayDiff = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);
  for (const e of free.filter(t => t.tipo === 'entrada')) {
    const s = saidas.find(x => !used.has(x.id) && x.account_id !== e.account_id && Math.abs(Number(x.valor) - Number(e.valor)) < 0.005 && dayDiff(x.data, e.data) <= 2);
    if (s) { used.add(s.id); pairs.push([s, e]); }
  }
  return pairs;
}
