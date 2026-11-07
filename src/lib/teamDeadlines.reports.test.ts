import { describe, it, expect } from 'vitest';
import { overdueReports } from './teamDeadlines';
const pf = [{ id: 'a', report_delivered: true }, { id: 'b', report_delivered: false }];
describe('relatórios em atraso', () => {
  it('antes ou no dia do prazo não há atraso', () => { expect(overdueReports(pf, '2026-11-06', '2026-11-06')).toEqual([]); });
  it('depois do prazo conta só os não enviados', () => { expect(overdueReports(pf, '2026-11-06', '2026-11-07').map(p => p.id)).toEqual(['b']); });
});
