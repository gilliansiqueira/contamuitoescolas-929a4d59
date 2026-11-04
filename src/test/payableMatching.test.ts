import { describe, it, expect } from 'vitest';
import { matchPayables } from '@/lib/payableMatching';

const p = (key: string, valor: number, dueDate = '2026-11-02', categoriaKey = 'agua') => ({ key, valor, dueDate, categoriaKey });
const t = (id: string, valor: number, data = '2026-11-02', itemKey: string | null = null) => ({ id, valor, data, itemKey });

describe('matchPayables', () => {
  it('reconhece pagamento antecipado até 7 dias antes', () => {
    expect(matchPayables([p('a', 500)], [t('x', 500, '2026-10-30')]).has('a')).toBe(true);
  });
  it('não aceita pagamento 8 dias antes', () => {
    expect(matchPayables([p('a', 500)], [t('x', 500, '2026-10-25')]).has('a')).toBe(false);
  });
  it('aceita juros até 3% do valor', () => {
    expect(matchPayables([p('a', 2000)], [t('x', 2055)]).has('a')).toBe(true);
    expect(matchPayables([p('a', 2000)], [t('x', 2070)]).has('a')).toBe(false);
  });
  it('uma saída não quita duas contas iguais', () => {
    expect(matchPayables([p('a', 100), p('b', 100)], [t('x', 100)]).size).toBe(1);
  });
  it('lote: soma de contas do mesmo vencimento numa saída', () => {
    const r = matchPayables([p('a', 300), p('b', 700)], [t('x', 1000)]);
    expect(r.has('a') && r.has('b')).toBe(true);
  });
  it('vínculo manual quita a conta', () => {
    expect(matchPayables([p('a', 100)], [], new Map([['a', 'x']])).has('a')).toBe(true);
  });
  it('prefere a saída conciliada no mesmo item', () => {
    const r = matchPayables([p('a', 100, '2026-11-02', 'agua'), p('b', 100, '2026-11-02', 'luz')], [t('x', 100, '2026-11-02', 'luz')]);
    expect(r.has('b')).toBe(true);
  });
});
