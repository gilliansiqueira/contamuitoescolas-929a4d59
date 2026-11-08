// Regras puras da integração Olist ERP (testadas em src/test/olistPush.test.ts).
// Nada aqui decide receita/despesa pelo sinal: o sentido vem do banco (tipo) e a natureza do item do modelo.

export type Tx = { id: string; data: string; descricao: string; valor: number; tipo: 'entrada' | 'saida'; model_item_id: string | null };
export type HistoryRow = { descricao: string; tipo: string; model_item_id: string };
export type OpenBill = { id: number; valor: number; saldo?: number | null; dataVencimento: string | null };
export type ModelItem = { id: string; entra_no_resultado: boolean; impacta_caixa: boolean };

export function normDesc(s: string): string {
  return (s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, ' ')
    .replace(/[0-9]+/g, ' ')
    .replace(/[^A-Z ]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Categoria do lançamento: a já escolhida pela equipe; senão a mais frequente em lançamentos parecidos (≥ 60%). */
export function suggestCategory(tx: Tx, history: HistoryRow[]): { modelItemId: string | null; origem: 'item' | 'historico' | 'a_classificar' } {
  if (tx.model_item_id) return { modelItemId: tx.model_item_id, origem: 'item' };
  const key = normDesc(tx.descricao);
  if (!key) return { modelItemId: null, origem: 'a_classificar' };
  const counts = new Map<string, number>();
  let total = 0;
  for (const h of history) {
    if (h.tipo !== tx.tipo || normDesc(h.descricao) !== key) continue;
    counts.set(h.model_item_id, (counts.get(h.model_item_id) ?? 0) + 1);
    total++;
  }
  let best: string | null = null, n = 0;
  for (const [k, v] of counts) if (v > n) { best = k; n = v; }
  if (best && n / total >= 0.6) return { modelItemId: best, origem: 'historico' };
  return { modelItemId: null, origem: 'a_classificar' };
}

/** Operação (transferência, aplicação, aporte): impacta só o Caixa, nunca o Resultado. */
export const isOperation = (item: ModelItem | undefined) => !!item && item.impacta_caixa && !item.entra_no_resultado;

const dayDiff = (a: string, b: string) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 864e5);

/** Conta em aberto da Olist a baixar: mesmo valor e vencimento até 7 dias depois / 3 dias antes do pagamento. Só com candidato único. */
export function pickOpenBill(tx: Tx, open: OpenBill[], used: Set<number> = new Set()): number | null {
  const c = open.filter(b => {
    if (used.has(b.id) || !b.dataVencimento) return false;
    const v = Number(b.saldo ?? b.valor);
    if (Math.abs(v - tx.valor) > 0.009) return false;
    const d = dayDiff(b.dataVencimento.slice(0, 10), tx.data);
    return d >= -3 && d <= 7;
  });
  return c.length === 1 ? c[0].id : null;
}

export const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const toBr = (iso: string) => iso.split('-').reverse().join('/');

export type OlistCaixa = { id: number; data: string; valor: number; tipo: string; historico?: string; categoriaId?: number | null };

/** Nome da contraparte, igual no extrato ("Pix enviado - X", "Pagamento de Título - X") e na Olist ("Pix para X | INT...", "Pagamento X | INT..."). */
export function counterpartKey(s: string): string {
  const base = String(s ?? '').split('|')[0].replace(/\(extrato [^)]*\)/i, '');
  return normDesc(base)
    .replace(/^(PIX (ENVIADO|RECEBIDO|PARA|DE)( DE| PARA)?|PAGAMENTO( DE TITULO| DE BOLETO)?|TED (ENVIADA|RECEBIDA)|TRANSFERENCIA (ENVIADA|RECEBIDA))\b/, '')
    .replace(/^(CP )/, '')
    .replace(/\b(LTDA|S A|SA|ME|EIRELI|EPP)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Categoria da Olist pelo que a equipe já classificou lá em lançamentos da mesma contraparte e sentido (≥ 60%). Ignora "A classificar". */
export function suggestOlistCategory(tx: Pick<Tx, 'descricao' | 'tipo'>, caixa: OlistCaixa[], ignoreCat: number | null = null): number | null {
  const key = counterpartKey(tx.descricao);
  if (!key) return null;
  const t = tx.tipo === 'saida' ? 'D' : 'C';
  const counts = new Map<number, number>();
  let total = 0;
  for (const e of caixa) {
    if (e.tipo !== t || !e.categoriaId || e.categoriaId === ignoreCat) continue;
    if (counterpartKey(e.historico ?? '') !== key) continue;
    counts.set(e.categoriaId, (counts.get(e.categoriaId) ?? 0) + 1);
    total++;
  }
  let best: number | null = null, n = 0;
  for (const [k, v] of counts) if (v > n) { best = k; n = v; }
  return best && n / total >= 0.6 ? best : null;
}
/** Lançamento já existente no Caixa da Olist: mesmo sentido, mesmo valor, data até 1 dia de diferença; cada um usado uma vez; ignora os criados por nós. */
export function findExisting(tx: Pick<Tx, 'data' | 'valor' | 'tipo'>, caixa: OlistCaixa[], used: Set<number>, ours: Set<number> = new Set()): number | null {
  const t = tx.tipo === 'saida' ? 'D' : 'C';
  const c = caixa.filter(e => !used.has(e.id) && !ours.has(e.id) && e.tipo === t && Math.abs(Math.abs(Number(e.valor)) - tx.valor) <= 0.009 && Math.abs(dayDiff(String(e.data).slice(0, 10), tx.data)) <= 1);
  c.sort((a, b) => Math.abs(dayDiff(String(a.data).slice(0, 10), tx.data)) - Math.abs(dayDiff(String(b.data).slice(0, 10), tx.data)));
  return c[0]?.id ?? null;
}

/** Diferença por dia entre o extrato do banco e o Caixa da Olist (entradas − saídas). */
export function dailyDiff(bank: Pick<Tx, 'data' | 'valor' | 'tipo'>[], caixa: OlistCaixa[]): { data: string; banco: number; olist: number; diferenca: number }[] {
  const m = new Map<string, { banco: number; olist: number }>();
  const g = (d: string) => { if (!m.has(d)) m.set(d, { banco: 0, olist: 0 }); return m.get(d)!; };
  for (const b of bank) g(b.data).banco += b.tipo === 'saida' ? -b.valor : b.valor;
  for (const e of caixa) if (e.tipo === 'C' || e.tipo === 'D') g(String(e.data).slice(0, 10)).olist += e.tipo === 'D' ? -Math.abs(Number(e.valor)) : Math.abs(Number(e.valor));
  return [...m].map(([data, v]) => ({ data, banco: +v.banco.toFixed(2), olist: +v.olist.toFixed(2), diferenca: +(v.banco - v.olist).toFixed(2) }))
    .filter(r => Math.abs(r.diferenca) > 0.009).sort((a, b) => a.data.localeCompare(b.data));
}
