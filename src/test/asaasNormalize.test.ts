// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { normalizePayment, summarize, tokenKind, diffSales, saleSignature } from '../../supabase/functions/asaas-sync/normalize';

const pago = { id: 'pay_1', value: 100, netValue: 97.01, billingType: 'PIX', status: 'RECEIVED', paymentDate: '2026-11-05', creditDate: '2026-11-05', dateCreated: '2026-11-01' };
describe('Asaas', () => {
  it('taxa = valor − líquido e recebido conta como pago', () => {
    const s = normalizePayment(pago);
    expect(s.taxas).toBe(2.99); expect(s.status).toBe('approved'); expect(s.canal).toBe('pix');
  });
  it('vencido/pendente não somam valores', () => {
    const r = summarize([normalizePayment(pago), normalizePayment({ ...pago, id: 'p2', status: 'OVERDUE' })]);
    expect(r.liquido).toBe(97.01); expect(r.quantidade).toBe(2);
  });
  it('releitura igual não regrava', () => {
    const s = normalizePayment(pago);
    expect(diffSales([s], new Map([[s.external_id, saleSignature(s)]])).iguais).toBe(1);
  });
  it('reconhece chaves', () => {
    expect(tokenKind('$aact_prod_abc')).toBe('producao'); expect(tokenKind('$aact_hmlg_abc')).toBe('teste'); expect(tokenKind('xyz')).toBeNull();
  });
});
