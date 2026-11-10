// Regras puras do conector Asaas (somente leitura). Testadas em src/test/asaasNormalize.test.ts.
export interface Sale {
  external_id: string; order_id: string | null; external_reference: string | null;
  canal: string; canal_evidencia: string | null; status: string | null; status_detail: string | null;
  payment_type: string | null; payment_method: string | null; installments: number | null;
  valor_bruto: number; taxas: number; valor_liquido: number | null; valor_estornado: number;
  fee_details: { type: string; amount: number; fee_payer: string | null }[];
  descricao: string | null; date_created: string | null; date_approved: string | null; date_last_updated: string | null;
  money_release_date: string | null; money_release_status: string | null; currency: string | null;
}
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
const r2 = (n: number) => Math.round(n * 100) / 100;
const PAGO = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);

/** Situação Asaas → situação comum (approved = pago). */
export function mapStatus(s: string | null): string | null {
  if (!s) return null;
  if (PAGO.has(s)) return 'approved';
  if (s === 'REFUNDED' || s === 'REFUND_REQUESTED' || s === 'REFUND_IN_PROGRESS') return 'refunded';
  if (s === 'CHARGEBACK_REQUESTED' || s === 'CHARGEBACK_DISPUTE' || s === 'AWAITING_CHARGEBACK_REVERSAL') return 'charged_back';
  if (s === 'OVERDUE') return 'overdue';
  if (s === 'PENDING' || s === 'AWAITING_RISK_ANALYSIS') return 'pending';
  return s.toLowerCase();
}

/** Converte uma cobrança do GET /v3/payments em registro normalizado. Canal = forma de cobrança (billingType). */
// deno-lint-ignore no-explicit-any
export function normalizePayment(p: any): Sale {
  const bruto = r2(num(p?.value));
  const liq = p?.netValue == null ? null : r2(num(p.netValue));
  const taxas = liq == null ? 0 : r2(bruto - liq);
  const status = str(p?.status);
  const bt = str(p?.billingType);
  return {
    external_id: String(p?.id), order_id: str(p?.installment) ?? str(p?.subscription),
    external_reference: str(p?.externalReference), canal: bt ? bt.toLowerCase() : 'desconhecido', canal_evidencia: bt ? `billingType=${bt}` : null,
    status: mapStatus(status), status_detail: status, payment_type: bt, payment_method: bt,
    installments: p?.installmentNumber == null ? null : num(p.installmentNumber),
    valor_bruto: bruto, taxas, valor_liquido: liq,
    valor_estornado: status === 'REFUNDED' ? bruto : 0,
    fee_details: taxas ? [{ type: 'asaas', amount: taxas, fee_payer: 'collector' }] : [],
    descricao: [str(p?.description), str(p?.customer) && `cliente ${p.customer}`].filter(Boolean).join(' · ') || null,
    date_created: str(p?.dateCreated), date_approved: str(p?.clientPaymentDate) ?? str(p?.paymentDate),
    date_last_updated: str(p?.paymentDate) ?? str(p?.dateCreated),
    money_release_date: str(p?.creditDate) ?? str(p?.estimatedCreditDate), money_release_status: p?.creditDate ? 'released' : (PAGO.has(status ?? '') ? 'pending' : null),
    currency: 'BRL',
  };
}
export function saleSignature(s: Sale): string {
  return [s.status, s.status_detail, s.valor_bruto, s.taxas, s.valor_liquido, s.valor_estornado, s.money_release_date, s.money_release_status].join('|');
}
export function dedupeSales(list: Sale[]): Sale[] { const m = new Map<string, Sale>(); for (const s of list) m.set(s.external_id, s); return [...m.values()]; }
export function diffSales(incoming: Sale[], existing: Map<string, string>) {
  const novos: Sale[] = [], atualizados: Sale[] = []; let iguais = 0;
  for (const s of incoming) { const o = existing.get(s.external_id); if (o === undefined) novos.push(s); else if (o !== saleSignature(s)) atualizados.push(s); else iguais++; }
  return { novos, atualizados, iguais };
}
export function summarize(list: Sale[]) {
  const out = { quantidade: 0, bruto: 0, taxas: 0, liquido: 0, estornado: 0, porCanal: {} as Record<string, { quantidade: number; bruto: number; taxas: number; liquido: number }>, porStatus: {} as Record<string, number> };
  for (const s of list) {
    out.quantidade++; const k = s.status ?? 'sem_status'; out.porStatus[k] = (out.porStatus[k] ?? 0) + 1;
    out.estornado = r2(out.estornado + s.valor_estornado);
    if (s.status !== 'approved') continue;
    const liq = s.valor_liquido ?? r2(s.valor_bruto - s.taxas);
    out.bruto = r2(out.bruto + s.valor_bruto); out.taxas = r2(out.taxas + s.taxas); out.liquido = r2(out.liquido + liq);
    const c = (out.porCanal[s.canal] ??= { quantidade: 0, bruto: 0, taxas: 0, liquido: 0 });
    c.quantidade++; c.bruto = r2(c.bruto + s.valor_bruto); c.taxas = r2(c.taxas + s.taxas); c.liquido = r2(c.liquido + liq);
  }
  return out;
}
/** Chave Asaas: $aact_prod_… (produção) ou $aact_hmlg_… (sandbox). */
export const tokenKind = (t: string): 'producao' | 'teste' | null => t.startsWith('$aact_prod_') ? 'producao' : t.startsWith('$aact_hmlg_') ? 'teste' : (t.startsWith('$aact_') ? 'producao' : null);
export const apiBase = (kind: string | null) => kind === 'teste' ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3';
