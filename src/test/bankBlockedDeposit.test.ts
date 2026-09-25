import { describe, it, expect } from 'vitest';
import { parseOFX, parsePdfLines } from '@/lib/bankStatements/parsers';

const tx = (d: string, v: string, m: string, id: string) =>
  `<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>${d}<TRNAMT>${v}<FITID>${id}<MEMO>${m}</STMTTRN>`;

describe('depósito de cheque bloqueado', () => {
  it('OFX: ignora o bloqueado e mantém a liberação', () => {
    const ofx = `<OFX><BANKTRANLIST>${tx('20260910', '1641.25', 'DEP.CHEQUE BLOQ.1D', 'a')}${tx('20260911', '1055.00', 'LIBERAÇÃO DE DEPÓSITO BLOQUEADO', 'b')}${tx('20260918', '470.25', 'DEP CH.CANAL ATEND.1D', 'c')}</BANKTRANLIST></OFX>`;
    const r = parseOFX(ofx);
    expect(r.transactions.map(t => t.valor)).toEqual([1055]);
    expect(r.avisos[0]).toContain('2 depósito');
  });
  it('PDF: ignora valor com asterisco', () => {
    const r = parsePdfLines([
      '10/09/2026 95 DEP.CHEQUE BLOQ.1D R$ 1.641,25*',
      '11/09/2026 95 LIBERAÇÃO DE DEPÓSITO BLOQUEADO R$ 586,25C',
    ]);
    expect(r.transactions.map(t => t.valor)).toEqual([586.25]);
  });
});
