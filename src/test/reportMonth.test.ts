import { describe, it, expect } from 'vitest';
import { defaultReportMonth, prevMonthOf } from '@/lib/reportMonth';

describe('defaultReportMonth', () => {
  it('29/10 abre em outubro', () => expect(defaultReportMonth('2026-10-29', false)).toBe('2026-10'));
  it('05/11 com pendentes abre em outubro', () => expect(defaultReportMonth('2026-11-05', false)).toBe('2026-10'));
  it('05/11 sem pendentes abre em novembro', () => expect(defaultReportMonth('2026-11-05', true)).toBe('2026-11'));
  it('20/11 abre em novembro', () => expect(defaultReportMonth('2026-11-20', false)).toBe('2026-11'));
  it('janeiro volta para dezembro do ano anterior', () => expect(prevMonthOf('2027-01')).toBe('2026-12'));
});
