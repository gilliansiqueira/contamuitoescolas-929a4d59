import { describe, it, expect } from 'vitest';
import { parseOFX } from '@/lib/bankStatements/parsers';
const tx = (d: string, v: string, m: string) => `<STMTTRN><DTPOSTED>${d}<TRNAMT>${v}<MEMO>${m}</STMTTRN>`;
describe('OFX linhas de saldo', () => {
  it('ignora SALDO* e mantém movimentos reais', () => {
    const ofx = `<BANKTRANLIST>${tx('20261103','664.93','SALDO TOTAL')}${tx('20261103','344.40','SALDO BLOQUEADO')}${tx('20261103','1000.00','PIX RECEBIDO FILIPE')}${tx('20261104','-169.00','TAR PLANO ADAPT')}</BANKTRANLIST>`;
    const r = parseOFX(ofx);
    expect(r.transactions.map(t => t.valor)).toEqual([1000, 169]);
  });
});
