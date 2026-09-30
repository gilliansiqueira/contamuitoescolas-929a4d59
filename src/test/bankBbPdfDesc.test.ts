import { describe, expect, it } from 'vitest';
import { parsePdfLines } from '@/lib/bankStatements/parsers';
import lines from './fixtures/bbBairroAlto2909.json';

describe('PDF BB em ordem decrescente (Bairro Alto)', () => {
  it('usa o saldo mais recente e cobre até a data de emissão', () => {
    const r = parsePdfLines(lines as string[]);
    expect(r.transactions.map(t => [t.data, t.tipo, t.valor])).toEqual(expect.arrayContaining([
      ['2026-09-10', 'saida', 93.1], ['2026-09-21', 'entrada', 7500], ['2026-09-21', 'saida', 6018.02],
    ]));
    expect(r.transactions).toHaveLength(3);
    expect(r.saldoFinalInformado).toBe(4862.01);
    expect(r.periodoFim).toBe('2026-09-29');
  });
});
