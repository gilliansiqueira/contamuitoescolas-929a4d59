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
