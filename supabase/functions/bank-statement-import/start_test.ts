import { assertEquals } from 'jsr:@std/assert';
import { filterRowsFromStart } from './start.ts';
Deno.test('ignora antes de novembro/2026, mantém 01/11', () => {
  const r = filterRowsFromStart([{ data: '2026-01-15' }, { data: '2026-10-31' }, { data: '2026-11-01' }, { data: '2026-12-02' }], '2026-11');
  assertEquals(r.ignored, 2); assertEquals(r.kept.map(x => x.data), ['2026-11-01', '2026-12-02']);
});
Deno.test('sem mês de início não filtra', () => { assertEquals(filterRowsFromStart([{ data: '2020-01-01' }], null).ignored, 0); });
