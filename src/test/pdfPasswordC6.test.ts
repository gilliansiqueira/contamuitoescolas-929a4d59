import { describe, it, expect } from 'vitest';
import { isC6Pdf, parseC6PdfLines } from '@/lib/bankStatements/parsers';

const lines = [
  'Extrato da conta', 'Período da Exportação Saldo no dia da exportação', '01/09/2026 a 30/09/2026 R$ 20,52',
  'Setembro 2026 ( 01/09/2026 - 30/09/2026 ) Entradas: R$ 0,00 • Saídas: R$ 26,90',
  '04/09 04/09 Outros gastos PARC MAQ C6 PAY -R$ 6,90', 'Saldo contábil do dia 04/09/26 R$ 67,42',
  '25/09 25/09 Outros gastos SEGURO CONTA C6 Set 26 -R$ 20,00', 'Saldo contábil do dia 25/09/26 R$ 47,42',
  'No app do C6 Bank',
];

describe('extrato C6 em PDF', () => {
  it('lê os lançamentos e fecha com os saldos impressos', () => {
    expect(isC6Pdf(lines)).toBe(true);
    const r = parseC6PdfLines(lines);
    expect(r.transactions.map(t => [t.data, t.valor, t.tipo])).toEqual([['2026-09-04', 6.9, 'saida'], ['2026-09-25', 20, 'saida']]);
    expect(r.saldoFinalInformado).toBe(47.42);
  });
  it('bloqueia quando um saldo do dia não fecha', () => {
    const bad = lines.map(l => l.replace('R$ 47,42', 'R$ 40,00'));
    expect(() => parseC6PdfLines(bad)).toThrow(/não fecha/);
  });
});
