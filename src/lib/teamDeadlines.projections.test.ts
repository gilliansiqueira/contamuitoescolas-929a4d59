import { describe, it, expect } from 'vitest';
import { isProjectionDelivered, overdueProjections } from './teamDeadlines';
const ok = (k: string, at = '2026-10-29T15:00:00Z') => ({ school_id: 'a', step_key: k, status: 'completed', completed_at: at });
describe('projeções em atraso', () => {
  it('3 etapas concluídas = entregue', () => {
    expect(isProjectionDelivered([ok('proj_futuras'), ok('proj_realizado'), ok('proj_simulacao')], '2026-10-30')).toBe(true);
  });
  it('falta uma etapa = não entregue', () => {
    expect(isProjectionDelivered([ok('proj_futuras'), ok('proj_realizado')], '2026-10-30')).toBe(false);
  });
  it('futuras marcada há mais de 15 dias não vale', () => {
    expect(isProjectionDelivered([ok('proj_futuras', '2026-10-10T12:00:00Z'), ok('proj_realizado'), ok('proj_simulacao')], '2026-10-30')).toBe(false);
    expect(isProjectionDelivered([ok('proj_futuras', '2026-10-15T12:00:00Z'), ok('proj_realizado'), ok('proj_simulacao')], '2026-10-30')).toBe(true);
  });
  it('só atrasa depois do prazo', () => {
    expect(overdueProjections(['a'], [], '2026-10-30', '2026-10-30')).toEqual([]);
    expect(overdueProjections(['a'], [], '2026-10-30', '2026-10-31')).toEqual(['a']);
  });
});
