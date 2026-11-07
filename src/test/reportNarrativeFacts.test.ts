import { describe, it, expect } from 'vitest';
import { pctChange, shiftMonth, unknownNumbers } from '@/lib/reportNarrativeFacts';

describe('reportNarrativeFacts', () => {
  it('queda de receita de 181 mil para 161 mil ≈ 11%', () => {
    expect(pctChange(161042.28, 181042.28)).toBe(-11);
  });
  it('sem base não calcula variação', () => {
    expect(pctChange(100, 0)).toBeNull();
  });
  it('troca de ano no mês anterior', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-09', -12)).toBe('2025-09');
  });
  it('aponta número que não estava nos fatos', () => {
    const facts = 'Mês: receitas R$ 181.042,28. KPI Lucratividade: 12,8%.';
    expect(unknownNumbers('Receitas de R$ 181.042,28 e lucratividade de 12,8%', facts)).toEqual([]);
    expect(unknownNumbers('Receitas de R$ 190.000,00 e lucratividade de 15%', facts)).toEqual(['R$ 190.000,00', '15%']);
  });
});

import { profitabilityFacts } from '@/lib/reportNarrativeFacts';
describe('profitabilityFacts', () => {
  it('com receita integral salva ela é a principal', () => {
    const l = profitabilityFacts({ operacional: 12.82, total: 10, integral: 20.5, receitaIntegral: 200000 });
    expect(l[0]).toContain('receita integral');
    expect(l[0]).toContain('20,50%');
  });
  it('com operações mostra os dois cenários', () => {
    const l = profitabilityFacts({ operacional: 15, total: 8.4, integral: null });
    expect(l).toHaveLength(1);
    expect(l[0]).toContain('15,00%');
    expect(l[0]).toContain('8,40%');
  });
  it('sem operações mostra uma só', () => {
    expect(profitabilityFacts({ operacional: 15, total: 15, integral: null })[0]).toBe('Lucratividade do mês: 15,00%.');
  });
});
