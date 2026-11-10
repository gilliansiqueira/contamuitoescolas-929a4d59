import { describe, it, expect } from 'vitest';
import { parseBankTemplate, TEMPLATE_HEADER, buildBankTemplateXlsx, parseXLSX } from '@/lib/bankStatements/parsers';
import * as XLSX from 'xlsx';
import { validateStatementIdentity } from '@/lib/bankStatements/identity';

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
  const account = { school_id: 'ficticia', banco: 'Bradesco', agencia: '0123', conta: '0012345-6', holder_document: '00000000000000' };
  it('modelo preenchido preserva identidade, todos os lançamentos e saldo', () => {
    const wb = XLSX.read(buildBankTemplateXlsx(account), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Extrato, { header: 1 });
    const header = rows.findIndex(r => r[0] === 'Data');
    rows.splice(header + 1, rows.length - header - 1, ['Saldo anterior','','','',1000], ['10/11/2026','Fictício A',100,'',1100], ['11/11/2026','Fictício B','',20,1080]);
    wb.Sheets.Extrato = XLSX.utils.aoa_to_sheet(rows);
    const result = parseXLSX(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions.map(t => t.valor)).toEqual([100,20]);
    expect(result.saldoFinalInformado).toBe(1080);
    expect(result.bloqueiaImportacao).toBe(false);
    expect(() => validateStatementIdentity(result.identity, account, 'ficticia')).not.toThrow();
  });
  it('modelo não é entregue com cadastro incompleto', () => expect(() => buildBankTemplateXlsx({ ...account, agencia: null })).toThrow('Complete'));
  it('modelo não é entregue com banco desconhecido', () => expect(() => buildBankTemplateXlsx({ ...account, banco: 'Banco fictício' })).toThrow('Complete'));
});
