import { describe, it, expect } from 'vitest';
import { resultadoEco, sazonalidade } from '@/lib/previsao';

describe('resultado da Ecoturismo', () => {
  it('desconta fixos proporcionais à receita do mês', () => {
    // receita eco 100 de 400 total → 25% dos fixos (200) = 50
    expect(resultadoEco(60, 10, 200, 100, 300)).toBe(0);
  });
  it('sem receita no mês não leva fixos', () => {
    expect(resultadoEco(-20, 0, 500, 0, 0)).toBe(-20);
  });
  it('sazonalidade soma 1', () => {
    const s = sazonalidade([1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(s[0]).toBe(0.25); expect(s[1]).toBe(0.75);
  });
});
