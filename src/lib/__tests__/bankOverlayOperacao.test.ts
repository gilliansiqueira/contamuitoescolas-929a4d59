import { describe, it, expect } from 'vitest';
import { applyCashflowOverlay } from '../bankCashflowOverlay';
import { getEffectiveClassification, getSaldoImpact } from '../classificationUtils';
import { resolveEntryLedgerRule } from '../ledgerEngine';

const row = (o: Partial<Parameters<typeof applyCashflowOverlay>[1][number]>) =>
  applyCashflowOverlay([], [{ id: '1', data: '2026-09-03', descricao: 'X', valor: 100, tipo: 'saida', tipo_nome: 'Operação', ...o }], '2026-09-01', 's')[0];

describe('overlay Fluxo Bancário — Operação', () => {
  it('Operação saída sem item afeta só o caixa', () => {
    const e = row({ valor: 7000 });
    expect(getEffectiveClassification(e, [])).toBe('operacao');
    expect(getSaldoImpact(e, [])).toBe(-7000);
  });
  it('Operação entrada soma no caixa', () => {
    const e = row({ tipo: 'entrada' });
    expect(getEffectiveClassification(e, [])).toBe('operacao');
    expect(getSaldoImpact(e, [])).toBe(100);
  });
  it('Pró-Labore como Operação fica fora do Resultado com o nome do item', () => {
    const e = row({ valor: 2000, item_nome: 'Pró-Labore' });
    expect(getEffectiveClassification(e, [])).toBe('operacao');
    expect(resolveEntryLedgerRule(e, []).label).toBe('Pró-Labore');
    expect(getSaldoImpact(e, [])).toBe(-2000);
  });
  it('Antecipação entrada soma no caixa com o nome do item', () => {
    const e = row({ tipo: 'entrada', valor: 10181.42, item_nome: 'Antecipação' });
    expect(getEffectiveClassification(e, [])).toBe('operacao');
    expect(resolveEntryLedgerRule(e, []).label).toBe('Antecipação');
    expect(getSaldoImpact(e, [])).toBe(10181.42);
  });
});
