import { describe, it, expect } from 'vitest';
import { effectiveReplaceCutoff } from '@/lib/projectionReplace';
describe('effectiveReplaceCutoff', () => {
  it('começa na sexta antecipada quando o arquivo grava antes de hoje (São Carlos 05/11)', () => {
    expect(effectiveReplaceCutoff('2026-11-01', '2026-11-05', ['2026-10-30', '2026-11-03', '2026-11-05'])).toBe('2026-10-30');
  });
  it('mantém hoje como piso quando o arquivo não tem datas anteriores', () => {
    expect(effectiveReplaceCutoff('2026-11-01', '2026-11-05', ['2026-11-05', '2026-11-10'])).toBe('2026-11-05');
  });
  it('ignora contas antigas muito antes do corte', () => {
    expect(effectiveReplaceCutoff('2026-11-05', '2026-11-05', ['2026-09-01', '2026-11-06'])).toBe('2026-11-05');
  });
  it('substituir tudo continua igual', () => {
    expect(effectiveReplaceCutoff('0000-01-01', '2026-11-05', ['2026-10-30'])).toBe('0000-01-01');
  });
});
describe('effectiveReplaceCutoff – arquivo cobrindo o mês (Manaus Laranjeiras)', () => {
  it('cartão enviado em 25/11 com vendas diárias desde 03/11 substitui desde 03/11', () => {
    const dates = ['2026-11-03','2026-11-05','2026-11-10','2026-11-14','2026-11-17','2026-11-21','2026-11-24','2026-12-02'];
    expect(effectiveReplaceCutoff('2026-11-25', '2026-11-25', dates)).toBe('2026-11-03');
  });
});
