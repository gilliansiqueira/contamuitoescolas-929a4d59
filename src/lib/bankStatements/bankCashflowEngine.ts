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
  has_auto_invest?: boolean;
  auto_invest_saldo_inicial?: number | null;
  auto_invest_saldo_data?: string | null;
}

export type MovementKind = 'normal' | 'auto_aplicacao' | 'auto_resgate' | 'operacao' | 'ignorar' | 'transferencia';
export type SplitCategoria = 'normal' | 'operacao' | 'ignorar';
export interface BankSplit { id: string; valor: number; categoria: SplitCategoria; descricao: string | null; note: string | null; sort_order: number; model_item_id?: string | null }
export const isAutoInvest = (t: Pick<BankTx, 'movement_kind'>) => t.movement_kind === 'auto_aplicacao' || t.movement_kind === 'auto_resgate';
/** Operação: fora de entradas/saídas realizadas, mas continua no saldo (igual às Operações do Dashboard). */
export const isOperacao = (t: Pick<BankTx, 'movement_kind'>) => t.movement_kind === 'operacao';
/** Descrição exibida: editada pelo admin ou, se vazia, a original do banco. */
export const displayDesc = (t: Pick<BankTx, 'descricao' | 'descricao_editada'>) => t.descricao_editada?.trim() || t.descricao;

export interface BankTx {
  id: string;
  account_id: string;
  import_id: string;
  data: string;
  descricao: string;
  descricao_editada?: string | null;
  valor: number;
  tipo: 'entrada' | 'saida';
  transfer_pair_id: string | null;
  recon_status: ReconStatus;
  model_item_id?: string | null;
  recon_by_email: string | null;
  recon_at: string | null;
  recon_note: string | null;
  created_at: string;
  movement_kind?: MovementKind;
  splits?: BankSplit[];
}

export const signed = (t: Pick<BankTx, 'valor' | 'tipo'>) => (t.tipo === 'entrada' ? Number(t.valor) : -Number(t.valor));

/** Lançamentos anteriores ou iguais à data do saldo inicial já estão contidos nele. */
export const countsForAccount = (acc: BankAccount, t: BankTx) =>
  !acc.saldo_inicial_data || t.data > acc.saldo_inicial_data;

/** Movimentos de aplicação automática até a data do saldo inicial da aplicação já estão nele. */
export const countsForInvest = (acc: BankAccount, t: BankTx) => {
  const d = acc.auto_invest_saldo_data || acc.saldo_inicial_data;
  return !d || t.data > d;
};

export interface AccountBalances { emConta: number; aplicado: number; total: number }

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Dois saldos por conta: em conta e aplicado automaticamente.
 * Aplicação automática (saída da conta) soma na aplicação; resgate faz o contrário.
 * O total só muda com movimentos reais (rendimento, tarifas, recebimentos, pagamentos).
 */
export function accountBalances(acc: BankAccount, txs: BankTx[], upTo: string): AccountBalances {
  let emConta = Number(acc.saldo_inicial) || 0;
  let aplicado = acc.has_auto_invest ? Number(acc.auto_invest_saldo_inicial) || 0 : 0;
  for (const t of txs) {
    if (t.account_id !== acc.id || t.data > upTo) continue;
    if (countsForAccount(acc, t)) emConta += signed(t);
    if (isAutoInvest(t) && countsForInvest(acc, t)) aplicado -= signed(t);
  }
  return { emConta: r2(emConta), aplicado: r2(aplicado), total: r2(emConta + aplicado) };
}

/** Saldo disponível total (em conta + aplicado). */
export function accountBalance(acc: BankAccount, txs: BankTx[], upTo: string): number {
  return accountBalances(acc, txs, upTo).total;
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
  aplicacoesAutomaticas: number;
  pendentesQtd: number;
  pendentesValor: number;
  percentConciliado: number;
  operacoesIn: number;
  operacoesOut: number;
  ignorados: number;
}

/** Transferências entre contas próprias (par confirmado) e Operações ficam fora de entradas/saídas. */
export function summarize(accounts: BankAccount[], txs: BankTx[], from: string, to: string, today: string): PilotSummary {
  const accMap = new Map(accounts.map(a => [a.id, a]));
  let entradas = 0, saidas = 0, transf = 0, auto = 0, pendQ = 0, pendV = 0, resolved = 0, total = 0, opIn = 0, opOut = 0, ign = 0;
  for (const t of txs) {
    const acc = accMap.get(t.account_id);
    if (!acc || t.data < from || t.data > to) continue;
    total++;
    if (t.recon_status === 'pendente') { pendQ++; pendV += Number(t.valor); } else resolved++;
    if (!countsForAccount(acc, t)) continue;
    if (isAutoInvest(t)) { auto += signed(t) * -1; continue; }
    if (t.transfer_pair_id) { transf += Number(t.valor); continue; }
    if (t.movement_kind === 'transferencia') { transf += Number(t.valor) * 2; continue; }
    const parts: { valor: number; cat: string }[] = t.splits?.length
      ? t.splits.map(s => ({ valor: Number(s.valor), cat: s.categoria }))
      : [{ valor: Number(t.valor), cat: t.movement_kind === 'operacao' || t.movement_kind === 'ignorar' ? t.movement_kind : 'normal' }];
    for (const p of parts) {
      if (p.cat === 'ignorar') { ign += p.valor; continue; }
      if (p.cat === 'operacao') { if (t.tipo === 'entrada') opIn += p.valor; else opOut += p.valor; continue; }
      if (t.tipo === 'entrada') entradas += p.valor; else saidas += p.valor;
    }
  }
  const saldoAtual = accounts.reduce((s, a) => s + accountBalance(a, txs, today), 0);
  return {
    saldoAtual: Math.round(saldoAtual * 100) / 100,
    entradasRealizadas: r2(entradas),
    saidasRealizadas: r2(saidas),
    transferenciasInternas: transf / 2,
    aplicacoesAutomaticas: r2(auto),
    pendentesQtd: pendQ,
    pendentesValor: pendV,
    percentConciliado: total ? (resolved / total) * 100 : 0,
    operacoesIn: r2(opIn),
    operacoesOut: r2(opOut),
    ignorados: r2(ign),
  };
}

/** Saldo corrente linha a linha (por conta ou consolidado), em ordem de data/importação. */
export function runningBalances(accounts: BankAccount[], txs: BankTx[], accountId: string | 'all'): Map<string, number> {
  const accs = accounts.filter(a => accountId === 'all' || a.id === accountId);
  const accMap = new Map(accs.map(a => [a.id, a]));
  let s = accs.reduce((acc, a) => acc + (Number(a.saldo_inicial) || 0) + (a.has_auto_invest ? Number(a.auto_invest_saldo_inicial) || 0 : 0), 0);
  const out = new Map<string, number>();
  const sorted = txs.filter(t => accMap.has(t.account_id)).sort((a, b) => a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  for (const t of sorted) {
    const acc = accMap.get(t.account_id)!;
    if (countsForAccount(acc, t)) s += signed(t);
    if (isAutoInvest(t) && countsForInvest(acc, t)) s -= signed(t);
    out.set(t.id, Math.round(s * 100) / 100);
  }
  return out;
}

/** Sugere pares de transferência: mesmo valor, sentidos opostos, contas diferentes, até 2 dias. */
export function suggestTransferPairs(txs: BankTx[]): [BankTx, BankTx][] {
  const free = txs.filter(t => !t.transfer_pair_id && !isAutoInvest(t));
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

export const DEFAULT_AUTO_INVEST_PATTERNS = ['bb rende facil', 'bb rende f', 'aplicacao automatica', 'resgate automatico', 'aplic aut', 'resg aut', 'invest facil', 'aplicacao programada', 'resgate programado'];

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Classifica aplicação/resgate automáticos pela descrição original do banco. */
export function detectMovementKind(descricao: string, tipo: 'entrada' | 'saida', patterns: string[]): MovementKind {
  const d = norm(descricao);
  if (!patterns.some(p => p.trim() && d.includes(norm(p)))) return 'normal';
  if (/rendiment|juros|\bir\b|iof/.test(d)) return 'normal';
  return tipo === 'saida' ? 'auto_aplicacao' : 'auto_resgate';
}

/** Transferência entre contas próprias: a descrição cita a razão social da própria empresa. */
export const isOwnTransfer = (t: Pick<BankTx, 'transfer_pair_id' | 'movement_kind'>) => !!t.transfer_pair_id || t.movement_kind === 'transferencia';
export function detectOwnTransfer(descricao: string, ownNames: string[]): boolean {
  const d = norm(descricao);
  return ownNames.some(n => n.trim().length >= 3 && d.includes(norm(n)));
}

type PairTx = Pick<BankTx, 'id' | 'account_id' | 'data' | 'valor' | 'tipo' | 'transfer_pair_id' | 'movement_kind'>;
const dDiff = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);
const pairable = (t: PairTx) => !t.transfer_pair_id && !isAutoInvest(t) && t.movement_kind !== 'operacao' && t.movement_kind !== 'ignorar';

/** Outra ponta: mesmo valor, sentido oposto, outra conta, até 2 dias; prefere data mais próxima e já marcada. */
export function findTransferCounterpart<T extends PairTx>(tx: T, txs: T[], used: Set<string> = new Set()): T | null {
  let best: T | null = null; let bestScore = Infinity;
  for (const c of txs) {
    if (c.id === tx.id || used.has(c.id) || !pairable(c) || c.account_id === tx.account_id || c.tipo === tx.tipo) continue;
    if (Math.abs(Number(c.valor) - Number(tx.valor)) >= 0.005) continue;
    const d = dDiff(c.data, tx.data); if (d > 2) continue;
    const score = d - (c.movement_kind === 'transferencia' ? 0.5 : 0);
    if (score < bestScore) { best = c; bestScore = score; }
  }
  return best;
}

/** Pares automáticos a partir das linhas marcadas como transferência que ainda não têm par. */
export function autoTransferPairs<T extends PairTx>(txs: T[]): [T, T][] {
  const used = new Set<string>(); const out: [T, T][] = [];
  const anchors = txs.filter(t => t.movement_kind === 'transferencia' && pairable(t)).sort((a, b) => a.data.localeCompare(b.data));
  for (const a of anchors) {
    if (used.has(a.id)) continue;
    const c = findTransferCounterpart(a, txs, used);
    if (c) { used.add(a.id); used.add(c.id); out.push([a, c]); }
  }
  return out;
}

/** Sugestão de nome para "lembrar": trecho depois de "Cp :NNNN-" ou texto sem prefixos/números. */
export function suggestOwnName(descricao: string): string {
  const cp = descricao.match(/Cp\s*:\s*\d+\s*-\s*([^"|]+)/i);
  let s = cp ? cp[1] : descricao.replace(/pix (recebido|enviado)|recebimento pix|pix_cred|transfer[êe]ncia|ted|doc|pagamento de titulo|[:"|\-]/gi, ' ');
  s = s.replace(/\d{5,}/g, ' ').replace(/\b(ltda|me|eireli|s\/?a)\b\.?/gi, ' ').replace(/\s+/g, ' ').trim();
  return s.toLowerCase();
}
