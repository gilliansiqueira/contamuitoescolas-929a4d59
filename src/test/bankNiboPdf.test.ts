import { describe, it, expect } from 'vitest';
import lines from './fixtures/niboHublaGo.json';
import { isNiboContasPdf, parseNiboContasPdfLines } from '@/lib/bankStatements/parsers';

describe('Nibo Contas & Extratos (Hubla Go Company)', () => {
  it('lê todas as linhas, inclusive as sem data, e fecha com os saldos', () => {
    expect(isNiboContasPdf(lines)).toBe(true);
    const r = parseNiboContasPdfLines(lines);
    const ent = r.transactions.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0);
    const sai = r.transactions.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0);
    console.log(r.transactions.length, ent.toFixed(2), sai.toFixed(2), r.saldoFinalInformado, r.divergencias);
    expect(r.bloqueiaImportacao).toBeFalsy();
    expect(r.transactions.length).toBeGreaterThan(10);
    expect(r.transactions.some(t => t.valor === 4843.53 && t.tipo === 'saida')).toBe(true);
  });
});
