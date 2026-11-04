import { describe, it, expect } from 'vitest';
import { moneyAlerts, onlyMine } from '@/lib/teamAlerts';

describe('avisos de dinheiro', () => {
  it('agrupa contas que vencem hoje por empresa com total', () => {
    const a = moneyAlerts({ payToday: [{ schoolId: 'a', schoolName: 'A', valor: 100 }, { schoolId: 'a', schoolName: 'A', valor: 50 }], scheduleToday: [], notPaid: [], cashRisks: [], staleStatements: [] });
    expect(a).toHaveLength(1);
    expect(a[0].text).toContain('2 conta(s) vencem hoje');
    expect(a[0].text).toContain('150,00');
  });
  it('saldo negativo e vencidas sem saída são atraso (vermelho)', () => {
    const a = moneyAlerts({ payToday: [], scheduleToday: [], notPaid: [{ schoolId: 'b', schoolName: 'B', valor: 10 }], cashRisks: [{ schoolId: 'b', schoolName: 'B', firstNegativeDate: '2026-11-06', minBalance: -500 }], staleStatements: [] });
    expect(a.map(x => x.tone)).toEqual(['late', 'late']);
    expect(a[0].text).toContain('06/11');
  });
  it('avisos de empresa fora da carteira não aparecem', () => {
    const r = onlyMine([{ schoolId: 'a' }, { schoolId: 'x' }, {}], ['a']);
    expect(r).toEqual([{ schoolId: 'a' }, {}]);
  });
});
