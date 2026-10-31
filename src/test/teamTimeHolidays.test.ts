import { describe, it, expect } from 'vitest';
import { classifyDay } from '@/components/team/TeamTimePanel';
const day = (dia: string) => ({ dia, marcacoes: [], primeira_marcacao: null, situacao: 'falta', ocorrencia: 'Falta', horario_previsto: '08:00 12:00 13:00 17:00', synced_at: null, horas_extras: null } as any);
describe('feriados no Ponto', () => {
  for (const d of ['2026-10-12', '2026-11-02', '2026-11-20'])
    it(`${d} não é falta`, () => { const c = classifyDay(day(d), null, '2026-12-01'); expect(c.faltaDia).toBe(false); expect(c.feriado).toBe(true); });
  it('13/10 sem batida continua falta', () => expect(classifyDay(day('2026-10-13'), null, '2026-12-01').faltaDia).toBe(true));
});
