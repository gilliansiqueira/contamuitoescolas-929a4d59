import { it, expect } from 'vitest';
import lines from './fixtures/bradescoFazenda0610.json';
import { parseBradescoPdfLines, isBradescoPdf } from '@/lib/bankStatements/parsers';
it('Bradesco Fazenda: lê os dois blocos sem repetir e usa o último saldo', () => {
  expect(isBradescoPdf(lines as string[])).toBe(true);
  const r = parseBradescoPdfLines(lines as string[]);
  expect(r.bloqueiaImportacao).toBeFalsy();
  expect(r.transactions).toHaveLength(12);
  expect(r.saldoFinalInformado).toBe(-136.1);
  expect(r.periodoFim).toBe('2026-10-06');
  expect(r.transactions.filter(t => t.valor === 2325.83)).toHaveLength(1);
  expect(r.transactions[0].descricao).toBe('STONE VISA DEBITO - STONE INSTITUICAO DE PAGAMENTO');
  expect(r.transactions.find(t => t.valor === 1100)?.tipo).toBe('saida');
});
