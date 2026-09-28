import { it, expect } from 'vitest';
import lines from './fixtures/sicrediDourados2509.json';
import { parsePdfLines } from '@/lib/bankStatements/parsers';

it('Sicredi Dourados 25/09: lançamentos, cheque bloqueado e saldos', () => {
  const r = parsePdfLines(lines as string[]);
  expect(r.saldoFinalInformado).toBe(-340.6);
  expect(r.saldoComAplicacaoInformado).toBe(567.19);
  expect(r.periodoFim).toBe('2026-09-25');
  const d25 = r.transactions.filter(t => t.data === '2026-09-25');
  expect(d25.map(t => t.valor).sort()).toEqual([290.41, 51.19].sort());
  expect(r.transactions.some(t => /DEP CHEQUE/.test(t.descricao))).toBe(false);
  expect(r.avisos.join(' ')).not.toMatch(/não fecha/);
  expect(r.transactions.filter(t => t.futuro)).toHaveLength(1);
});

it('Sicredi: sinal negativo do saldo não inverte o recebimento', () => {
  const r = parsePdfLines([
    'Extrato (Período de 01/09/2026 a 28/09/2026)',
    '14/09/2026 DEB.CTA.FATURA 030021947 -21.556,05 -23.456,05',
    '14/09/2026 RECEBIMENTO PIX 17211744000158 INFLUX ENGLISH SC PIX_CRED 1.451,52 -22.004,53',
    '14/09/2026 COMPRAS NACIONAIS MAHALO CUIABA BR VE0565385 -30,00 -22.034,53',
  ]);
  const t = r.transactions ?? (r as any).linhas;
  const rec = t.find((x: any) => /INFLUX/.test(x.descricao));
  expect(rec.tipo).toBe('entrada');
  expect(rec.valor).toBe(1451.52);
  expect(t.filter((x: any) => x.tipo === 'saida').length).toBe(2);
});
