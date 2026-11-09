import { describe, it, expect } from 'vitest';
import { normalizePayment, detectCanal, dedupeSales, diffSales, saleSignature, summarize, windows, tokenKind } from '../../supabase/functions/mercadopago-sync/normalize';

const pay = (p: Record<string, unknown> = {}) => ({
  id: 111, status: 'approved', status_detail: 'accredited', transaction_amount: 100, currency_id: 'BRL',
  payment_type_id: 'credit_card', payment_method_id: 'visa', installments: 3,
  fee_details: [{ type: 'mercadopago_fee', amount: 4.99, fee_payer: 'collector' }],
  transaction_details: { net_received_amount: 95.01 }, transaction_amount_refunded: 0,
  date_created: '2026-11-03T10:00:00.000-03:00', date_last_updated: '2026-11-03T10:01:00.000-03:00',
  money_release_date: '2026-12-03T10:00:00.000-03:00', order: { id: 9, type: 'mercadopago' }, ...p,
});

describe('Mercado Pago — normalização', () => {
  it('bruto, taxas, líquido, parcelas e ids', () => {
    const s = normalizePayment(pay({ external_reference: 'PED-1' }));
    expect(s).toMatchObject({ external_id: '111', order_id: '9', external_reference: 'PED-1', valor_bruto: 100, taxas: 4.99, valor_liquido: 95.01, installments: 3, payment_method: 'visa' });
  });
  it('taxa paga pelo comprador não reduz o recebimento', () => {
    const s = normalizePayment(pay({ fee_details: [{ type: 'financing_fee', amount: 10, fee_payer: 'payer' }, { type: 'mercadopago_fee', amount: 2, fee_payer: 'collector' }] }));
    expect(s.taxas).toBe(2);
  });
  it('dois canais distintos: checkout e Mercado Livre', () => {
    expect(detectCanal(pay()).canal).toBe('checkout');
    expect(detectCanal(pay({ order: { id: 1, type: 'mercadolibre' } })).canal).toBe('mercado_livre');
    expect(detectCanal(pay({ order: null, point_of_interaction: { type: 'POINT' } })).canal).toBe('point');
  });
  it('sem evidência fica desconhecido (não inventa)', () => {
    expect(detectCanal({ id: 1 }).canal).toBe('desconhecido');
  });
  it('releitura não duplica e fica com a versão mais nova', () => {
    const a = normalizePayment(pay());
    const b = normalizePayment(pay({ status: 'refunded', transaction_amount_refunded: 100, date_last_updated: '2026-11-05T09:00:00.000-03:00' }));
    const out = dedupeSales([a, b, a]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('refunded');
  });
  it('estorno aparece como atualização; igual não regrava', () => {
    const a = normalizePayment(pay());
    const b = normalizePayment(pay({ status: 'refunded', transaction_amount_refunded: 100 }));
    const d = diffSales([b, normalizePayment(pay({ id: 222 }))], new Map([['111', saleSignature(a)], ['222', saleSignature(normalizePayment(pay({ id: 222 })))]]));
    expect(d.atualizados.map(s => s.external_id)).toEqual(['111']);
    expect(d.iguais).toBe(1);
    expect(d.novos).toHaveLength(0);
  });
  it('resumo soma só aprovados e separa por canal', () => {
    const r = summarize([normalizePayment(pay()), normalizePayment(pay({ id: 2, order: { type: 'mercadolibre' } })), normalizePayment(pay({ id: 3, status: 'rejected' }))]);
    expect(r.quantidade).toBe(3);
    expect(r.bruto).toBe(200);
    expect(r.taxas).toBe(9.98);
    expect(r.porCanal.checkout.quantidade).toBe(1);
    expect(r.porCanal.mercado_livre.liquido).toBe(95.01);
    expect(r.porStatus.rejected).toBe(1);
  });
  it('janelas de até 15 dias cobrindo o período', () => {
    expect(windows('2026-11-01', '2026-11-30')).toEqual([{ from: '2026-11-01', to: '2026-11-15' }, { from: '2026-11-16', to: '2026-11-30' }]);
  });
  it('tipo de token', () => {
    expect(tokenKind('APP_USR-123')).toBe('producao');
    expect(tokenKind('TEST-123')).toBe('teste');
    expect(tokenKind('xyz')).toBeNull();
  });
});
