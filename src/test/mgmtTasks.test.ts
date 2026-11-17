import { describe, it, expect } from 'vitest';
import { filterTasks, isOverdue, type MgmtTask } from '@/lib/mgmtTasks';
const base = (o: Partial<MgmtTask>): MgmtTask => ({ id: 'x', title: 't', description: null, school_id: null, assignee_id: 'a', created_by: 'a', due_date: null, status: 'pendente', completed_at: null, created_at: '2026-11-01', ...o });
describe('tarefas da gestão', () => {
  it('atrasada só se pendente e prazo passou', () => {
    expect(isOverdue(base({ due_date: '2026-11-16' }), '2026-11-17')).toBe(true);
    expect(isOverdue(base({ due_date: '2026-11-17' }), '2026-11-17')).toBe(false);
    expect(isOverdue(base({ due_date: '2026-11-01', status: 'concluida' }), '2026-11-17')).toBe(false);
  });
  it('"Minhas" mostra só as abertas da própria pessoa', () => {
    const r = filterTasks([base({ id: '1' }), base({ id: '2', assignee_id: 'b' }), base({ id: '3', status: 'concluida' })], 'minhas', 'a', 'all', 'all');
    expect(r.map(t => t.id)).toEqual(['1']);
  });
  it('"Concluídas" mostra só concluídas', () => {
    const r = filterTasks([base({ id: '1' }), base({ id: '3', status: 'concluida' })], 'concluidas', 'a', 'all', 'all');
    expect(r.map(t => t.id)).toEqual(['3']);
  });
});
