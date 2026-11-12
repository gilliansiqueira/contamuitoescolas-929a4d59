import { describe, it, expect } from 'vitest';
import { overdueReports } from '@/lib/teamDeadlines';
describe('overdueReports com Não se aplica', () => {
  const p = [{ school_id: 'a', report_delivered: false }, { school_id: 'b', report_delivered: false }];
  it('ignora empresa com envio ao cliente "não se aplica"', () => {
    expect(overdueReports(p, '2026-11-07', '2026-11-12', new Set(['a'])).map(x => x.school_id)).toEqual(['b']);
  });
  it('sem envio e sem marcação continua atrasado', () => {
    expect(overdueReports(p, '2026-11-07', '2026-11-12').length).toBe(2);
  });
});
