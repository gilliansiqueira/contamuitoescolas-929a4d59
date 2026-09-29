import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { parseOFX, computeDedupHashes } from '@/lib/bankStatements/parsers';
const files = ['Caixa_São_Lucas.ofx', 'Caixa_Aniella.ofx', 'Sisprime_São_Lucas.ofx'].map(f => `/mnt/user-uploads/${f}`);
describe('OFX com FITID repetido', () => {
  it('não descarta linhas com código repetido', async () => {
    const r = parseOFX('<STMTTRN><DTPOSTED>20260901<TRNAMT>-18.65<FITID>000000<MEMO>IOF</STMTTRN><STMTTRN><DTPOSTED>20260901<TRNAMT>-33.37<FITID>000000<MEMO>JUROS</STMTTRN><STMTTRN><DTPOSTED>20260903<TRNAMT>440<FITID>031617<MEMO>A</STMTTRN><STMTTRN><DTPOSTED>20260903<TRNAMT>1250<FITID>031617<MEMO>B</STMTTRN><STMTTRN><DTPOSTED>20260904<TRNAMT>5<FITID>x1<MEMO>C</STMTTRN>');
    const h = await computeDedupHashes('A', r.transactions);
    expect(new Set(h).size).toBe(5);
    expect(r.transactions[4].bankRef).toBe('x1');
  });
  for (const f of files) it.skipIf(!existsSync(f))(`arquivo real ${f}`, async () => {
    const txt = readFileSync(f, 'latin1');
    const r = parseOFX(txt);
    const n = (txt.match(/<STMTTRN>/gi) || []).length;
    const h = await computeDedupHashes('A', r.transactions);
    console.log(f, n, r.transactions.length, new Set(h).size, r.transactions.reduce((s, t) => s + (t.tipo === 'entrada' ? t.valor : -t.valor), 0).toFixed(2));
    expect(new Set(h).size).toBe(r.transactions.length);
  });
});
