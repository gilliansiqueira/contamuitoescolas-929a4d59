import { it, expect } from 'vitest';
import lines from './fixtures/bbDourados2509.json';
import { parsePdfLines } from '@/lib/bankStatements/parsers';

it('BB Dourados 25/09: total = conta + saldo de fundos (ignora "Saldo" já descontado do aprovisionado)', () => {
  const r = parsePdfLines(lines as string[]);
  expect(r.saldoFinalInformado).toBe(-190.53);
  expect(r.saldoComAplicacaoInformado).toBe(151163.49);
  const fut = r.transactions.filter(t => t.futuro);
  expect(fut).toHaveLength(1);
  expect(fut[0]).toMatchObject({ valor: 2159.03, tipo: 'saida', data: '2026-09-25' });
});
