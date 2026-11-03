import { describe, it, expect } from 'vitest';
import { dropSponteCardCoveredByMaquininha } from '@/lib/import/sponteCardGuard';

const maq = [
  { data: '2026-11-05', origem: 'cartao', tipo: 'entrada' },
  { data: '2027-01-20', origem: 'cartao', tipo: 'entrada' },
];

describe('cartão do Sponte não coexiste com a maquininha', () => {
  it('descarta crédito do Sponte dentro do período da maquininha', () => {
    const r = dropSponteCardCoveredByMaquininha(
      [{ data: '2026-12-10', origem: 'sponte', tipo: 'entrada', payment_method_key: 'credito' }], maq);
    expect(r.dropped).toHaveLength(1);
  });
  it('mantém boleto/PIX do Sponte no mesmo período', () => {
    const r = dropSponteCardCoveredByMaquininha(
      [{ data: '2026-12-10', origem: 'sponte', tipo: 'entrada', payment_method_key: 'boleto' }], maq);
    expect(r.kept).toHaveLength(1);
  });
  it('mantém cartão do Sponte depois da última data da maquininha', () => {
    const r = dropSponteCardCoveredByMaquininha(
      [{ data: '2027-03-10', origem: 'sponte', tipo: 'entrada', payment_method_key: 'credito' }], maq);
    expect(r.kept).toHaveLength(1);
  });
});
