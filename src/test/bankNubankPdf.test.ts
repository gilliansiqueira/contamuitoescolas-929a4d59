import { describe, expect, it } from 'vitest';
import { isNubankPjPdf, parseNubankPjPdfLines } from '@/lib/bankStatements/parsers';
import lines from './fixtures/nubankWnc.json';
const L = lines as string[];
describe('PDF Nubank PJ (WNC)', () => {
  const r = parseNubankPjPdfLines(L);
  const rend = r.transactions.filter(t => t.descricao === 'Rendimento líquido');
  const mov = r.transactions.filter(t => t.descricao !== 'Rendimento líquido');
  it('reconhece', () => expect(isNubankPjPdf(L)).toBe(true));
  it('lê os lançamentos com sentido do bloco', () => {
    expect(mov.length).toBe(15);
    const e = mov.filter(t => t.tipo === 'entrada').reduce((a, t) => a + t.valor, 0);
    const s = mov.filter(t => t.tipo === 'saida').reduce((a, t) => a + t.valor, 0);
    expect(Math.round(e * 100) / 100).toBe(7602.96);
    expect(Math.round(s * 100) / 100).toBe(5828.34);
    expect(mov[0]).toMatchObject({ data: '2026-09-29', valor: 190, tipo: 'saida', descricao: 'Transferência enviada pelo Pix - Patricia Silva de Souza' });
  });
  it('rendimento e saldo final batem', () => {
    expect(Math.round(rend.reduce((a, t) => a + t.valor, 0) * 100) / 100).toBe(12.76);
    expect(r.saldoFinalInformado).toBe(50511.96);
    expect(r.periodoFim).toBe('2026-10-28');
  });
  it('bloqueia quando não fecha', () => {
    expect(() => parseNubankPjPdfLines(L.map(l => l.replace('EXPRESSO SAO MIGUEL S A   809,42', 'EXPRESSO SAO MIGUEL S A   909,42')))).toThrow(/Nada foi importado/);
  });
});
