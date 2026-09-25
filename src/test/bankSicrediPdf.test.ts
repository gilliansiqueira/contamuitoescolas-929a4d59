import { it, expect } from 'vitest';
import lines from './fixtures/sicrediDourados2509.json';
import { parsePdfLines } from '@/lib/bankStatements/parsers';

it('Sicredi Dourados 25/09: lançamentos, cheque bloqueado e saldos', () => {
  const r = parsePdfLines(lines as string[]);
  const last = r.transactions.filter(t => t.data === '2026-09-25');
  console.log(JSON.stringify({ n: r.transactions.length, sf: r.saldoFinalInformado, st: r.saldoComAplicacaoInformado, last, avisos: r.avisos }));
});
