import { describe, it, expect } from 'vitest';
import { parseCardSheet, isScientificId } from '@/lib/cardSheetParse';

describe('Stone ID nas planilhas de cartão', () => {
  it('reconhece o ID abreviado pelo Excel', () => {
    expect(isScientificId('4,14627E+13')).toBe(true);
    expect(isScientificId('29763997308072')).toBe(false);
  });
  it('bloqueia linhas com ID abreviado e guarda IDs inteiros como texto', () => {
    const rows = [['DATA DA VENDA', 'VALOR BRUTO', 'VALOR LÍQUIDO', 'STONE ID'],
      ['01/11/2026', '10,00', '9,50', 29763997308072], ['01/11/2026', '10,00', '9,50', '4,14627E+13']];
    const res = parseCardSheet(rows, 0, { data_venda: 0, bruto: 1, liquido: 2, nsu: 3 }, 'venda');
    expect(res.sciLines).toEqual([3]);
    expect(res.rows[0].nsu).toBe('29763997308072');
    expect(res.rows[0].raw['STONE ID']).toBe('29763997308072');
  });
});
