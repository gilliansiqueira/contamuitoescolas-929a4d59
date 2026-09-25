import { describe, it, expect } from 'vitest';
import { parsePdfLines } from '@/lib/bankStatements/parsers';

describe('PDF Sicoob', () => {
  it('importa efetivados (data sem ano) e futuros como previstos', () => {
    const r = parsePdfLines([
      'SICOOB Extrato Período: 01/09/2026 a 25/09/2026',
      '01/09 PIX RECEBIDO - OUTRA IF 500,00C',
      '02/09 DÉB. CONV. SEGUROS 72,20D',
      'LANÇAMENTOS FUTUROS',
      '13/10/2026 DÉB.CONV.TELECOMUN. 143,93',
    ]);
    const efet = r.transactions.filter(t => !t.futuro);
    const fut = r.transactions.filter(t => t.futuro);
    expect(efet).toHaveLength(2);
    expect(efet[0]).toMatchObject({ data: '2026-09-01', tipo: 'entrada', valor: 500 });
    expect(efet[1]).toMatchObject({ data: '2026-09-02', tipo: 'saida' });
    expect(fut).toHaveLength(1);
    expect(fut[0].tipo).toBe('saida');
  });
});

import piraquaraLines from './fixtures/sicoobPiraquara.json';
import { parsePdfLines as parsePira } from '@/lib/bankStatements/parsers';
import { it as itPira, expect as expectPira } from 'vitest';
itPira('Sicoob Piraquara: junta valor/marcador quebrados e fecha no saldo do extrato', () => {
  const r = parsePira(piraquaraLines as string[]);
  const efet = r.transactions.filter(t => !t.futuro);
  const mov = efet.reduce((a, t) => a + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
  expectPira(Math.round((72577 + mov) * 100) / 100).toBe(20375.72);
  expectPira(r.saldoFinalInformado).toBe(20375.72);
  expectPira(efet.find(t => t.valor === 2065.49)?.tipo).toBe('saida');
  expectPira(efet.find(t => t.valor === 1297.6)?.tipo).toBe('saida');
  expectPira(r.avisos?.some(a => a.includes('não fecha'))).toBeFalsy();
});
