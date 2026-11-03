import { describe, it, expect } from 'vitest';
import { projectCashRisk } from '@/lib/cashRisk';

describe('projectCashRisk', () => {
  // Caso Manaus: extrato até 04/11 enviado em 03/11
  const impacts = [
    { date: '2026-11-04', impacto: 18600.43 },
    { date: '2026-11-05', impacto: 12544.69 },
    { date: '2026-11-05', impacto: -96215.94 },
  ];
  it('extrato com data futura não pula os recebimentos do dia seguinte', () => {
    const r = projectCashRisk({ date: '2026-11-04', balance: 6916.4 }, impacts, '2026-11-03');
    expect(r.baseDate).toBe('2026-11-03');
    expect(r.minBalance).toBe(-58154.42);
    expect(r.firstNegativeDate).toBe('2026-11-05');
  });
  it('extrato de ontem soma desde hoje', () => {
    const r = projectCashRisk({ date: '2026-11-02', balance: 100 }, [{ date: '2026-11-03', impacto: -200 }], '2026-11-03');
    expect(r.minBalance).toBe(-100);
  });
});
