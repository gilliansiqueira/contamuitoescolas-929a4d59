import { describe, it, expect } from 'vitest';
import { parseBankTemplate, TEMPLATE_HEADER } from '@/lib/bankStatements/parsers';

describe('modelo de planilha de extrato', () => {
  const base = [TEMPLATE_HEADER, ['Saldo anterior', '', '', '', 1127.61]];
  it('importa quando os saldos fecham', () => {
    const r = parseBankTemplate([...base, ['09/09/2026', 'SEGURADORA', '', 251.45, 876.16], ['14/09/2026', 'SEGURADORA', '', '340,34', '535,82']])!;
    expect(r.bloqueiaImportacao).toBe(false);
    expect(r.saldoFinalInformado).toBe(535.82);
    expect(r.transactions).toHaveLength(2);
  });
  it('bloqueia e aponta a linha quando não fecha', () => {
    const r = parseBankTemplate([...base, ['09/09/2026', 'X', '', 251.45, 900]])!;
    expect(r.bloqueiaImportacao).toBe(true);
    expect(r.divergencias?.[0]).toContain('Linha 3');
  });
});
