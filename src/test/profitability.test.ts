import { isInvestmentMovementLabel } from '@/lib/ledgerEngine';
import { describe, it, expect } from 'vitest';
import { computeProfitability, integralClosing, isAutoProfitMonth } from '@/lib/profitability';

const base = { receitas: 100000, despesas: 70000, operacoesIn: 0, operacoesOut: 10000 };

describe('lucratividade automática', () => {
  it('operacional deixa operações de fora', () => {
    expect(computeProfitability(base).lucro_operacional).toBe(30);
  });
  it('total ignora aplicação e resgate (dinheiro guardado para render)', () => {
    const t = { ...base, operacoesIn: 5000, operacoesOut: 50000, investimentosIn: 5000, investimentosOut: 40000 };
    expect(computeProfitability(t).lucro_total).toBe(20);
  });
  it('reconhece rótulos de aplicação/resgate', () => {
    expect(isInvestmentMovementLabel('Operação (banco): Aplicação RDC')).toBe(true);
    expect(isInvestmentMovementLabel('Resgate automático')).toBe(true);
    expect(isInvestmentMovementLabel('Pró-labore')).toBe(false);
  });
  it('total considera as operações (ex.: parcela de empréstimo)', () => {
    expect(computeProfitability(base).lucro_total).toBe(20);
  });
  it('receita integral só existe quando preenchida', () => {
    expect(computeProfitability(base).lucro_integral).toBeNull();
    expect(computeProfitability(base, 140000).lucro_integral).toBe(50);
  });
  it('sem receita fica vazio', () => {
    expect(computeProfitability({ ...base, receitas: 0 }).lucro_operacional).toBeNull();
  });
  it('fechamento integral troca só a receita', () => {
    expect(integralClosing(base, 140000)).toEqual({ receitas: 140000, despesas: 70000, resultado: 70000, diferencaReceita: 40000 });
  });
  it('automático a partir de outubro/2026 até o mês anterior ao atual', () => {
    expect(isAutoProfitMonth('2026-09', '2026-11')).toBe(false);
    expect(isAutoProfitMonth('2026-10', '2026-11')).toBe(true);
    expect(isAutoProfitMonth('2026-11', '2026-11')).toBe(false);
  });
});
