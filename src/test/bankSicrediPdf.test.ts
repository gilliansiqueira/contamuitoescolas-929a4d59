import { it, expect } from 'vitest';
import lines from './fixtures/sicrediDourados2509.json';
import { parsePdfLines } from '@/lib/bankStatements/parsers';

it('Sicredi Dourados 25/09: lançamentos, cheque bloqueado e saldos', () => {
  const r = parsePdfLines(lines as string[]);
  expect(r.saldoFinalInformado).toBe(-340.6);
  expect(r.saldoComAplicacaoInformado).toBe(567.19);
  expect(r.periodoFim).toBe('2026-09-25');
  const d25 = r.transactions.filter(t => t.data === '2026-09-25');
  expect(d25.map(t => t.valor).sort()).toEqual([290.41, 51.19].sort());
  expect(r.transactions.some(t => /DEP CHEQUE/.test(t.descricao))).toBe(false);
  expect(r.avisos.join(' ')).not.toMatch(/não fecha/);
  expect(r.transactions.filter(t => t.futuro)).toHaveLength(1);
});
