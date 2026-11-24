import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { parseOFX } from '@/lib/bankStatements/parsers';
const tx = (d: string, v: string, id: string) => `<STMTTRN><DTPOSTED>${d}<TRNAMT>${v}<FITID>${id}<MEMO>Pix ${id}</STMTTRN>`;
afterEach(() => vi.useRealTimers());
describe('Cora OFX: saldo com data de fim do mês', () => {
  it('usa o saldo do download no último lançamento', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-24T12:00:00Z'));
    const ofx = `<BANKID>0403<DTSTART>20261101000000<DTEND>20261130000000<BANKTRANLIST>${tx('20261102', '100.00', 'a')}${tx('20261123', '50.00', 'b')}</BANKTRANLIST><LEDGERBAL><BALAMT>2510.63<DTASOF>20261130000000</LEDGERBAL>`;
    const r = parseOFX(ofx);
    expect(r.saldoFinalInformado).toBe(2510.63);
    expect(r.periodoFim).toBe('2026-11-23');
  });
  it('saldo posterior ao fim do extrato (Inter) segue descartado', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-24T12:00:00Z'));
    const ofx = `<BANKID>077<DTSTART>20261101<DTEND>20261120<BANKTRANLIST>${tx('20261120', '10.00', 'c')}</BANKTRANLIST><LEDGERBAL><BALAMT>99.00<DTASOF>20261124</LEDGERBAL>`;
    expect(parseOFX(ofx).saldoFinalInformado).toBeUndefined();
  });
  const f = '/mnt/user-uploads/zavadniak-ensino-de-idiomas-ltda_01112026_a_30112026_cff93c10.ofx';
  it.skipIf(!existsSync(f))('arquivo real da Cora SJP', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-24T12:00:00Z'));
    expect(parseOFX(readFileSync(f, 'latin1')).saldoFinalInformado).toBe(2510.63);
  });
});
