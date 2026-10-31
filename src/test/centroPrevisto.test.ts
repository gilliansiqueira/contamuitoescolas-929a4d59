import { describe, it, expect } from 'vitest';
import { matchGrupo, combinarItens } from '@/lib/centroPrevisto';

const groups = [
  { id: '1', name: 'Deserto do Atacama' },
  { id: '2', name: 'Patagonia' },
  { id: '9', name: 'A classificar' },
];

describe('centroPrevisto', () => {
  it('liga centros por nome com aliases', () => {
    expect(matchGrupo('Atacama', groups)?.id).toBe('1');
    expect(matchGrupo('Patagônia', groups)?.id).toBe('2');
    expect(matchGrupo('', groups)?.id).toBe('9');
    expect(matchGrupo('Xyz', groups)?.id).toBe('9');
  });
  it('não conta duas vezes o mesmo mês', () => {
    const r = [{ data: '2026-09-10' }];
    const p = [{ data: '2026-09-11' }, { data: '2026-10-01' }];
    expect(combinarItens(r, p, 'ambos').map(i => i.data)).toEqual(['2026-09-10', '2026-10-01']);
    expect(combinarItens(r, p, 'previsto')).toHaveLength(2);
  });
});
