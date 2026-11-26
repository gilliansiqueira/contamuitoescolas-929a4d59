import { describe, expect, it } from 'vitest';
import { isLolli, lolliMatchesPeriod } from '@/lib/lolli';
import { buildCommerceDRE, type CommerceDreRows } from '@/lib/ledgerEngine';
describe('isolamento da Lolli', () => {
  it('seleciona apenas a empresa importada', () => {
    expect(isLolli('11f200c9-e1ae-4336-8b2b-75e44eafd8dc')).toBe(true);
    expect(isLolli('a7786ff0-3387-4ca6-86fa-4b8e2af0a3df')).toBe(false);
    expect(isLolli(null)).toBe(false);
  });
  it('não inclui meses intermediários quando não foram selecionados', () => {
    expect(lolliMatchesPeriod('2026-06-10', ['2026-05', '2026-07'])).toBe(false);
    expect(lolliMatchesPeriod('2026-07-31', ['2026-05', '2026-07'])).toBe(true);
  });
});

describe('referência da DRE original', () => {
  const empty: CommerceDreRows = { sales: [], expenses: [], marketing: [], manualRevenues: [], groups: [], products: [], costs: [] };
  it('não deduz duas vezes um pedido cancelado', () => {
    const result = buildCommerceDRE({ ...empty, sales: [
      { valor_bruto: 1000, valor_liquido: 1000, status: 'Faturado' },
      { valor_bruto: 500, valor_liquido: 500, status: 'Cancelado' },
    ] });
    expect(result.receitaLiquida).toBe(1000);
    expect(result.cancelamentos).toBe(500);
  });
  it('mantém a precedência das receitas manuais da DRE', () => {
    const result = buildCommerceDRE({ ...empty, manualRevenues: [{ valor: 1000 }],
      sales: [{ valor_bruto: 2000, desconto: 100, status: 'Faturado' }] });
    expect(result.receitaBruta).toBe(1000);
    expect(result.receitaLiquida).toBe(900);
  });
  it('usa as despesas originais uma única vez, sem somar o caixa bancário', () => {
    const result = buildCommerceDRE({ ...empty, manualRevenues: [{ valor: 1000 }],
      expenses: [{ tipo: 'outros', categoria: 'Aluguel', valor: 200 }],
      groups: [{ categoria: 'Aluguel', grupo: 'Custos Fixos' }] });
    expect(result.resultadoOperacional).toBe(800);
    expect(result.despesasGrupos).toEqual([{ grupo: 'Custos Fixos', valor: 200 }]);
  });
});