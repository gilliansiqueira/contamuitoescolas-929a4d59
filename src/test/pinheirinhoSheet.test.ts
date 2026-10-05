import { test, expect } from 'vitest'; import { readFileSync } from 'fs';
import { parseXLSX, parseCSV, decodeBankText } from '@/lib/bankStatements/parsers';
const ab = (p: string) => { const b = readFileSync(p); const u = new Uint8Array(b.length); u.set(b); return u.buffer; };
for (const [k, f] of [['xlsx', () => parseXLSX(ab('src/test/fixtures/pinheirinho_fluxo.xlsx'))], ['csv', () => parseCSV(decodeBankText(ab('src/test/fixtures/pinheirinho_fluxo.csv')))]] as const)
  test(`planilha Pinheirinho ${k}`, () => {
    const r = f();
    console.log(k, JSON.stringify({ n: r.transactions.length, saldo: r.saldoFinalInformado, avisos: r.avisos, bl: r.bloqueiaImportacao, t: r.transactions }));
    expect(r.transactions).toHaveLength(6);
    expect(r.saldoFinalInformado).toBe(352.02);
    expect(r.transactions.filter(t => t.tipo === 'entrada')).toHaveLength(1);
    expect(r.transactions[0]).toMatchObject({ data: '2026-09-09', valor: 251.45, tipo: 'saida' });
    expect(r.bloqueiaImportacao).toBeFalsy();
  });
