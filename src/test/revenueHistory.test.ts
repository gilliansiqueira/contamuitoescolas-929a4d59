import { describe, it, expect } from 'vitest';
import { fillRevenueWithHistory } from '@/lib/revenueHistory';

const months = (vals: Record<number, number>) => Array.from({ length: 12 }, (_, i) => vals[i] ?? null);

describe('fillRevenueWithHistory', () => {
  it('mês com movimento na plataforma ignora o histórico', () => {
    const r = fillRevenueWithHistory([{ year: '2026', months: months({ 8: 500 }) }], [{ month: '2026-09', value: 999 }], '2026-10');
    expect(r.rows[0].months[8]).toBe(500);
    expect(r.historyMonths).toEqual([]);
  });
  it('mês vazio usa o histórico, e nunca depois do mês de referência', () => {
    const r = fillRevenueWithHistory([{ year: '2026', months: months({}) }], [{ month: '2026-01', value: 161051.04 }, { month: '2026-12', value: 1 }], '2026-10');
    expect(r.rows[0].months[0]).toBe(161051.04);
    expect(r.rows[0].months[11]).toBeNull();
    expect(r.historyMonths).toEqual(['2026-01']);
  });
});
