import { describe, it, expect } from 'vitest';
import { deadlineParts } from '@/lib/teamDeadlines';

const dl = [
  { rotulo: 'as projeções', data: '2026-10-30' },
  { rotulo: 'o texto e o relatório', data: '2026-11-06' },
];

describe('contagem de prazos', () => {
  it('29/10: projeção em 1 dia, relatório em 8', () => {
    expect(deadlineParts(dl, '2026-10-29').map(p => p.dias)).toEqual([1, 8]);
  });
  it('no dia mostra HOJE', () => {
    expect(deadlineParts(dl, '2026-10-30')[0].texto).toContain('HOJE');
  });
  it('prazo vencido some', () => {
    expect(deadlineParts(dl, '2026-10-31').map(p => p.rotulo)).toEqual(['o texto e o relatório']);
    expect(deadlineParts(dl, '2026-11-07')).toEqual([]);
  });
});
