import { describe, it, expect } from 'vitest';
import { canonicalProfessors } from '@/lib/renewal/professorNames';

describe('canonicalProfessors', () => {
  it('junta nome curto ao completo', () => {
    const m = canonicalProfessors(['Raissa Souza', 'Raissa Tavares de Souza', 'Isaac Ginoris', 'Isaac Ginoris Oramas']);
    expect(m.get('Raissa Souza')).toBe('Raissa Tavares de Souza');
    expect(m.get('Isaac Ginoris')).toBe('Isaac Ginoris Oramas');
  });
  it('não junta quando há dois completos incompatíveis', () => {
    const m = canonicalProfessors(['Ana Silva', 'Ana Maria Silva', 'Ana Paula Silva']);
    expect(m.has('Ana Silva')).toBe(false);
  });
  it('não junta primeiro nome diferente', () => {
    expect(canonicalProfessors(['Souza', 'Raissa Souza']).size).toBe(0);
  });
});
