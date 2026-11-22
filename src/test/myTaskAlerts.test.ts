import { describe, it, expect } from 'vitest';
import { myTaskAlerts } from '@/lib/teamAlerts';
const t = (o: any) => ({ id: '1', title: 'Obra WNC', assignee_id: 'isa', status: 'pendente', due_date: '2026-11-23', school_id: null, ...o });
describe('myTaskAlerts', () => {
  it('avisa a responsável no dia do prazo', () => {
    expect(myTaskAlerts([t({})], 'isa', '2026-11-23')).toHaveLength(1);
  });
  it('não avisa outra pessoa, tarefa concluída ou prazo futuro', () => {
    expect(myTaskAlerts([t({ assignee_id: 'ana' }), t({ status: 'concluida' }), t({ due_date: '2026-11-30' })], 'isa', '2026-11-23')).toHaveLength(0);
  });
});
