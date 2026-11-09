// Regras puras do conector Mercado Pago (somente leitura). Testadas em src/test/mercadoPagoNormalize.test.ts.
// Nunca inventa canal: sem evidência no próprio pagamento, fica "desconhecido".

export type Canal = 'checkout' | 'link' | 'point' | 'mercado_livre' | 'desconhecido';

export interface Sale {
  external_id: string;
  order_id: string | null;
  external_reference: string | null;
  canal: Canal;
  canal_evidencia: string | null;
  status: string | null;
  status_detail: string | null;
  payment_type: string | null;
  payment_method: string | null;
  installments: number | null;
  valor_bruto: number;
  taxas: number;
  valor_liquido: number | null;
  valor_estornado: number;
  fee_details: { type: string; amount: number; fee_payer: string | null }[];
  descricao: string | null;
  date_created: string | null;
  date_approved: string | null;
  date_last_updated: string | null;
  money_release_date: string | null;
  money_release_status: string | null;
  currency: string | null;
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Canal só a partir de campos do próprio pagamento; devolve também a evidência usada. */
// deno-lint-ignore no-explicit-any
export function detectCanal(p: any): { canal: Canal; evidencia: string | null } {
  const orderType = String(p?.order?.type ?? '').toLowerCase();
  const marketplace = String(p?.marketplace ?? '').toUpperCase();
  const poi = String(p?.point_of_interaction?.type ?? '').toUpperCase();
  const poiSub = String(p?.point_of_interaction?.sub_type ?? '').toUpperCase();
  if (orderType === 'mercadolibre') return { canal: 'mercado_livre', evidencia: 'order.type=mercadolibre' };
  if (marketplace === 'MELI') return { canal: 'mercado_livre', evidencia: 'marketplace=MELI' };
  if (poi === 'POINT' || p?.pos_id || poiSub === 'POINT') return { canal: 'point', evidencia: poi === 'POINT' ? 'point_of_interaction.type=POINT' : 'pos_id' };
  if (poi === 'PAYMENT_LINK' || poiSub === 'PAYMENT_LINK') return { canal: 'link', evidencia: 'point_of_interaction=PAYMENT_LINK' };
  if (poi.startsWith('CHECKOUT') || orderType === 'mercadopago') return { canal: 'checkout', evidencia: poi ? `point_of_interaction.type=${poi}` : 'order.type=mercadopago' };
  const ev = [poi && `poi=${poi}`, orderType && `order=${orderType}`, marketplace && `marketplace=${marketplace}`].filter(Boolean).join(';');
  return { canal: 'desconhecido', evidencia: ev || null };
}

/** Converte um pagamento do /v1/payments em venda normalizada (valores em reais). */
// deno-lint-ignore no-explicit-any
export function normalizePayment(p: any): Sale {
  const fees = (Array.isArray(p?.fee_details) ? p.fee_details : []).map((f: any) => ({ type: String(f?.type ?? ''), amount: r2(num(f?.amount)), fee_payer: str(f?.fee_payer) }));
  // Taxas cobradas da empresa (collector). As pagas pelo comprador não reduzem o recebimento.
  const taxas = r2(fees.filter((f: { fee_payer: string | null }) => f.fee_payer !== 'payer').reduce((s: number, f: { amount: number }) => s + f.amount, 0));
  const net = p?.transaction_details?.net_received_amount;
  const { canal, evidencia } = detectCanal(p);
  return {
    external_id: String(p?.id),
    order_id: str(p?.order?.id),
    external_reference: str(p?.external_reference),
    canal, canal_evidencia: evidencia,
    status: str(p?.status), status_detail: str(p?.status_detail),
    payment_type: str(p?.payment_type_id), payment_method: str(p?.payment_method_id),
    installments: p?.installments == null ? null : num(p.installments),
    valor_bruto: r2(num(p?.transaction_amount)),
    taxas,
    valor_liquido: net == null ? null : r2(num(net)),
    valor_estornado: r2(num(p?.transaction_amount_refunded)),
    fee_details: fees,
    descricao: str(p?.description),
    date_created: str(p?.date_created), date_approved: str(p?.date_approved),
    date_last_updated: str(p?.date_last_updated),
    money_release_date: str(p?.money_release_date), money_release_status: str(p?.money_release_status),
    currency: str(p?.currency_id),
  };
}

/** Assinatura estável para saber se a venda mudou (status, estorno, liberação). */
export function saleSignature(s: Sale): string {
  return [s.status, s.status_detail, s.valor_bruto, s.taxas, s.valor_liquido, s.valor_estornado, s.money_release_date, s.money_release_status, s.date_last_updated].join('|');
}

/** Mantém uma venda por id (a de date_last_updated mais recente) — releitura nunca duplica. */
export function dedupeSales(list: Sale[]): Sale[] {
  const m = new Map<string, Sale>();
  for (const s of list) {
    const cur = m.get(s.external_id);
    if (!cur || String(s.date_last_updated ?? '') >= String(cur.date_last_updated ?? '')) m.set(s.external_id, s);
  }
  return [...m.values()];
}

/** Classifica cada venda contra o que já está gravado: nova, atualizada ou igual. */
export function diffSales(incoming: Sale[], existing: Map<string, string>) {
  const novos: Sale[] = [], atualizados: Sale[] = []; let iguais = 0;
  for (const s of incoming) {
    const old = existing.get(s.external_id);
    if (old === undefined) novos.push(s);
    else if (old !== saleSignature(s)) atualizados.push(s);
    else iguais++;
  }
  return { novos, atualizados, iguais };
}

export interface Summary { quantidade: number; bruto: number; taxas: number; liquido: number; estornado: number; porCanal: Record<string, { quantidade: number; bruto: number; taxas: number; liquido: number }>; porStatus: Record<string, number> }
export function summarize(list: Sale[]): Summary {
  const out: Summary = { quantidade: 0, bruto: 0, taxas: 0, liquido: 0, estornado: 0, porCanal: {}, porStatus: {} };
  for (const s of list) {
    out.quantidade++;
    out.porStatus[s.status ?? 'sem_status'] = (out.porStatus[s.status ?? 'sem_status'] ?? 0) + 1;
    if (s.status !== 'approved') continue; // valores só de vendas aprovadas
    const liq = s.valor_liquido ?? r2(s.valor_bruto - s.taxas);
    out.bruto = r2(out.bruto + s.valor_bruto); out.taxas = r2(out.taxas + s.taxas); out.liquido = r2(out.liquido + liq); out.estornado = r2(out.estornado + s.valor_estornado);
    const c = (out.porCanal[s.canal] ??= { quantidade: 0, bruto: 0, taxas: 0, liquido: 0 });
    c.quantidade++; c.bruto = r2(c.bruto + s.valor_bruto); c.taxas = r2(c.taxas + s.taxas); c.liquido = r2(c.liquido + liq);
  }
  return out;
}

/** Quebra um intervalo em janelas de até `days` dias (o Mercado Pago limita a busca). */
export function windows(from: string, to: string, days = 15): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  let a = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (a <= end) {
    const b = new Date(a); b.setUTCDate(b.getUTCDate() + days - 1);
    const fim = b > end ? end : b;
    out.push({ from: a.toISOString().slice(0, 10), to: fim.toISOString().slice(0, 10) });
    a = new Date(fim); a.setUTCDate(a.getUTCDate() + 1);
  }
  return out;
}

/** Datas do Mercado Pago no fuso de Brasília (-03:00). */
export const brtBegin = (d: string) => `${d}T00:00:00.000-03:00`;
export const brtEnd = (d: string) => `${d}T23:59:59.999-03:00`;

export const tokenKind = (t: string): 'producao' | 'teste' | null => t.startsWith('APP_USR-') ? 'producao' : t.startsWith('TEST-') ? 'teste' : null;
