import { describe, expect, it } from 'vitest';
import { isBBContaCorrentePdf, parseBBContaCorrentePdfLines } from '@/lib/bankStatements/parsers';
import lines from './fixtures/bbSudoeste2710.json';

describe('PDF BB "Extrato de Conta Corrente" com (+)/(-) (Brasília Sudoeste)', () => {
  const r = parseBBContaCorrentePdfLines(lines as string[]);
  it('reconhece o formato', () => expect(isBBContaCorrentePdf(lines as string[])).toBe(true));
  it('saídas "(-)" viram saída e entradas "(+)" viram entrada', () => {
    const f = (d: string, v: number) => r.transactions.find(t => t.data === d && t.valor === v);
    expect(f('2026-10-20', 1764.98)?.tipo).toBe('saida');
    expect(f('2026-10-20', 1764.98)?.descricao).toBe('Pix - Enviado - RECEITA FEDERAL');
    expect(f('2026-10-13', 93.1)?.tipo).toBe('saida');
    expect(f('2026-10-05', 80)?.tipo).toBe('entrada');
    expect(f('2026-10-07', 1621)?.descricao).toBe('Pagamento de Boleto - CONFESSORES SOLUCOES CONTABEIS');
  });
  it('fecha com os saldos do extrato', () => {
    const mov = r.transactions.reduce((a, t) => a + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
    expect(Math.round((30244.64 + mov) * 100) / 100).toBe(13143.57);
    expect(r.saldoFinalInformado).toBe(13143.57);
    expect(r.saldoComAplicacaoInformado).toBe(15352.23);
    expect(r.periodoFim).toBe('2026-10-27');
  });
  it('bloqueia quando um saldo do dia não fecha', () => {
    const bad = (lines as string[]).map(l => l.replace('1.068,84 (-)', '1.068,84 (+)'));
    expect(() => parseBBContaCorrentePdfLines(bad)).toThrow(/não fecha/);
  });
});
