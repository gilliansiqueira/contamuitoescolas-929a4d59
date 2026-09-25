import { it, expect } from 'vitest';
import lines from './fixtures/bbJurassic2509.json';
import dourados from './fixtures/bbDourados2509.json';
import { parsePdfLines } from '@/lib/bankStatements/parsers';

it('BB Jurassic: traz efetivados + futuros e fecha 999,04 → 6,50', () => {
  const r = parsePdfLines(lines as string[]);
  const ef = r.transactions.filter(t => !t.futuro);
  const fut = r.transactions.filter(t => t.futuro);
  expect(r.saldoFinalInformado).toBe(6.5);
  expect(fut).toHaveLength(4);
  const mov = ef.reduce((a, t) => a + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
  expect(Math.round((999.04 + mov) * 100) / 100).toBe(6.5);
  expect(r.avisos.join(' ')).not.toMatch(/não fecha/);
  expect(ef[0].descricao).toMatch(/Cess.o Cr.d Liquid Princ - .*TOPAZIO/i);
  expect(ef.find(t => t.valor === 1710.22)?.tipo).toBe('saida');
});

it('BB Dourados continua fechando', () => {
  const r = parsePdfLines(dourados as string[]);
  expect(r.avisos.join(' ')).not.toMatch(/não fecha/);
});
