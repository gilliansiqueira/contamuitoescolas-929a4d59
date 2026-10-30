import { describe, it, expect } from 'vitest';
import { oldPendencies, managerAlerts, isOverdueRequest, reportAlert } from '@/lib/teamAlerts';

describe('avisos da equipe', () => {
  it('pendência antiga só com mais de 5 dias', () => {
    const m = oldPendencies([{ school_id: 'a', data: '2026-10-24' }, { school_id: 'a', data: '2026-10-23' }], '2026-10-29');
    expect(m.get('a')).toEqual({ count: 1, oldestDays: 6 });
  });
  it('gestora é avisada com 3 atrasos, não com 2', () => {
    expect(managerAlerts('Hannah', 3, '2026-10-29', '2026-10-29', 10)).toEqual(['Hannah acumula 3 empresas atrasadas']);
    expect(managerAlerts('Hannah', 2, '2026-10-29', '2026-10-29', 10)).toEqual([]);
  });
  it('sem atividade só a partir das 14h', () => {
    expect(managerAlerts('Geovanna', 0, '2026-10-28', '2026-10-29', 13)).toEqual([]);
    expect(managerAlerts('Geovanna', 0, '2026-10-28', '2026-10-29', 14)).toHaveLength(1);
  });
  it('pedido vencido e não resolvido entra no sininho', () => {
    expect(isOverdueRequest({ prazo: '2026-10-28', status: 'aberto' }, '2026-10-29')).toBe(true);
    expect(isOverdueRequest({ prazo: '2026-10-28', status: 'resolvido' }, '2026-10-29')).toBe(false);
    expect(isOverdueRequest({ prazo: '2026-10-29', status: 'aberto' }, '2026-10-29')).toBe(false);
  });
  it('relatório perto do prazo com 2 dias', () => {
    expect(reportAlert('2026-11-06', '2026-11-04', false)).toEqual({ kind: 'soon', days: 2 });
    expect(reportAlert('2026-11-06', '2026-11-03', false)).toBeNull();
  });
});

import { isTimedTaskOverdue } from '@/lib/teamAlerts';
describe('tarefa com horário', () => {
  it('avisa a partir das 9h se não marcada', () => {
    expect(isTimedTaskOverdue({ due_time: '09:00:00', status: 'open' }, 8 * 60 + 59)).toBe(false);
    expect(isTimedTaskOverdue({ due_time: '09:00:00', status: 'open' }, 9 * 60)).toBe(true);
  });
  it('some quando marcada', () => {
    expect(isTimedTaskOverdue({ due_time: '17:00:00', status: 'completed' }, 18 * 60)).toBe(false);
  });
});
