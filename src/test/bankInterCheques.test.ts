import { describe, it, expect } from 'vitest';
import { parseOFX } from '@/lib/bankStatements/parsers';
const tx = (d: string, v: string, m: string) => `<STMTTRN><DTPOSTED>${d}<TRNAMT>${v}<FITID>${m}${d}<MEMO>${m}</STMTTRN>`;
describe('Inter OFX cheques em compensação', () => {
  it('soma cheques recebidos do último dia ao saldo disponível', () => {
    const ofx = `<BANKID>077<BANKTRANLIST>${tx('20260924', '100.00', 'Pix recebido')}${tx('20260925', '887.50', 'Cheque recebido: "A"')}${tx('20260925', '468.00', 'Cheque recebido: "B"')}</BANKTRANLIST><LEDGERBAL><BALAMT>1000.00</LEDGERBAL>`;
    const r = parseOFX(ofx);
    expect(r.saldoFinalInformado).toBe(2355.5);
    expect(r.avisos.join(' ')).toMatch(/compensação/);
  });
});
