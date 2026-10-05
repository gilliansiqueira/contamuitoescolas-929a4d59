import { test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parsePdfLines } from '@/lib/bankStatements/parsers';
test('Sicredi: cheque bloqueado fica nos lançamentos e vira retido', () => {
  const r = parsePdfLines(JSON.parse(readFileSync('src/test/fixtures/sicrediDourados0510.json', 'utf8')));
  const efet = r.transactions.filter(t => !t.futuro);
  expect(efet).toHaveLength(9);
  expect(efet.some(t => t.valor === 435.6)).toBe(true);
  expect(r.saldoFinalInformado).toBe(-831.06);
  expect(r.saldoRetidoInformado).toBe(435.6);
  expect(r.saldoComAplicacaoInformado).toBe(3946.99);
  expect(r.avisos.join(' ')).not.toContain('não fecha');
});
