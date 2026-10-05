import { it, expect } from 'vitest';
import lines from './fixtures/picpayVitoria.json';
import { parsePicPayLines } from '@/lib/bankStatements/parsers';
it('PicPay Vitória: lê e fecha com o saldo de cada dia', () => {
  const r = parsePicPayLines(lines as string[]);
  console.log(r.transactions.length, r.periodoInicio, r.periodoFim, r.saldoFinalInformado, r.divergencias, r.transactions.slice(0, 4));
  expect(r.bloqueiaImportacao).toBe(false);
  expect(r.saldoFinalInformado).toBe(1087.34);
  expect(r.transactions[0]).toMatchObject({ data: '2026-10-02', tipo: 'entrada', valor: 481.9 });
  expect(r.transactions[1].descricao).toBe('Pix enviado NARA VIEIRA FRANCA DE CASTRO');
});
