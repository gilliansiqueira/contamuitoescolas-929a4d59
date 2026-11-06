import { describe, it, expect } from 'vitest';
import { summarizeSponteVsMaquininha } from '@/lib/import/sponteCardGuard';

const maq = [
  { data: '2026-11-05', origem: 'cartao', tipo: 'entrada', valor: 423 },
  { data: '2027-01-20', origem: 'cartao', tipo: 'entrada', valor: 600.8 },
];

describe('cartão do Sponte (a passar) soma com a maquininha (já passado)', () => {
  it('mantém todo crédito do Sponte dentro do período da maquininha', () => {
    const r = summarizeSponteVsMaquininha(
      [{ data: '2026-12-10', origem: 'sponte', tipo: 'entrada', valor: 333, payment_method_key: 'credito' }], maq);
    expect(r.kept).toHaveLength(1);
    expect(r.suspects).toHaveLength(0);
  });
  it('mesmo valor no mesmo mês só vira aviso, sem remover', () => {
    const r = summarizeSponteVsMaquininha(
      [{ data: '2026-11-20', origem: 'sponte', tipo: 'entrada', valor: 423, payment_method_key: 'credito' }], maq);
    expect(r.kept).toHaveLength(1);
    expect(r.suspects).toHaveLength(1);
  });
  it('totais separados por relatório', () => {
    const r = summarizeSponteVsMaquininha(
      [{ data: '2026-12-10', origem: 'sponte', tipo: 'entrada', valor: 333, payment_method_key: 'credito' },
       { data: '2026-12-10', origem: 'sponte', tipo: 'entrada', valor: 296, payment_method_key: 'boleto' }], maq);
    expect(r.sponteCard.total).toBe(333);
    expect(r.maquininha.total).toBeCloseTo(1023.8);
  });
});
