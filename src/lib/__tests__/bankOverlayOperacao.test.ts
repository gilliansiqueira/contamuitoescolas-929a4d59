import { describe, it, expect } from 'vitest';
import { applyCashflowOverlay } from '../bankCashflowOverlay';
import { getEffectiveClassification, getSaldoImpact } from '../classificationUtils';

describe('overlay Fluxo Bancário — Operação', () => {
  it('Operação saída afeta só o caixa', () => {
    const [e] = applyCashflowOverlay([], [{ id: '1', data: '2026-09-03', descricao: 'PIX', valor: 7000, tipo: 'saida', tipo_nome: 'Operação' }], '2026-09-01', 's');
    expect(getEffectiveClassification(e, [])).toBe('operacao');
    expect(getSaldoImpact(e, [])).toBe(-7000);
  });
  it('Operação entrada soma no caixa', () => {
    const [e] = applyCashflowOverlay([], [{ id: '2', data: '2026-09-03', descricao: 'X', valor: 100, tipo: 'entrada', tipo_nome: 'Operação' }], '2026-09-01', 's');
    expect(getEffectiveClassification(e, [])).toBe('operacao');
    expect(getSaldoImpact(e, [])).toBe(100);
  });
});
