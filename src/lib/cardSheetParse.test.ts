import { describe, it, expect } from 'vitest';
import { detectHeader, parseCardSheet, parseBRNumber, parseBRDate, suspectLines } from './cardSheetParse';

const sheet = [
  ['Relatório Stone'],
  ['Data da venda', 'Data de pagamento', 'Bandeira', 'Produto', 'Valor bruto', 'Taxa', 'Valor líquido', 'Stone ID'],
  ['01/10/2026', '02/10/2026', 'Visa', 'Débito', '1.000,00', '10,00', '990,00', 'A1'],
  ['01/10/2026', '31/10/2026', 'Master', 'Crédito', '500,50', '15,00', '485,50', 'A2'],
  ['01/10/2026', '31/10/2026', 'Master', 'Crédito', '500,50', '15,00', '485,50', 'A2'],
  ['Total', '', '', '', '2.001,00', '', '', ''],
];

describe('cardSheetParse', () => {
  it('lê números e datas brasileiros', () => {
    expect(parseBRNumber('1.500,50')).toBe(1500.5);
    expect(parseBRNumber('(10,00)')).toBe(-10);
    expect(parseBRDate('05/11/26')).toBe('2026-11-05');
  });
  it('acha o cabeçalho e as colunas', () => {
    const { headerRow, map } = detectHeader(sheet);
    expect(headerRow).toBe(1);
    expect(map).toMatchObject({ data_venda: 0, data_pagamento: 1, bandeira: 2, forma: 3, bruto: 4, taxa: 5, liquido: 6, nsu: 7 });
  });
  it('soma, separa a linha de total e mantém linhas repetidas com chave distinta', () => {
    const { headerRow, map } = detectHeader(sheet);
    const r = parseCardSheet(sheet, headerRow, map, 'recebimento');
    expect(r.rows).toHaveLength(3);
    expect(r.totalBruto).toBe(2001);
    expect(r.fileTotal).toBe(2001);
    expect(r.diff).toBe(0);
    expect(new Set(r.rows.map(x => x.row_key)).size).toBe(3);
    expect(r.porDia['2026-10-31'].qtd).toBe(2);
  });
  it('bloqueia e aponta a linha quando o total do arquivo não bate', () => {
    const bad = sheet.map(r => [...r]); bad[5][4] = '1.500,50';
    const { headerRow, map } = detectHeader(bad);
    const r = parseCardSheet(bad, headerRow, map, 'recebimento');
    expect(r.diff).toBe(-500.5);
    expect(suspectLines(r, true).map(x => x.line)).toEqual([4, 5]);
  });
});
