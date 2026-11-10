import { describe, it, expect } from 'vitest';
import { categoryFromDescriptionPrefix, findNameOnlyDuplicates } from '@/lib/categoryMatcher';

const known = ['Salário Instrutores', 'Propaganda', 'DL', 'Conservação /Melhorias'];
const mem = new Map([['conservacao e manutencao', 'Conservação /Melhorias'], ['obras pf', 'DL']]);

describe('categoria pela descrição (Omni)', () => {
  it('salário com nome vai para Salário Instrutores', () => {
    expect(categoryFromDescriptionPrefix('Salário Instrutores - Bianca Barbosa', mem, known)).toBe('Salário Instrutores');
  });
  it('gasto pessoal PF continua DL', () => {
    expect(categoryFromDescriptionPrefix('Obras - PF', mem, known)).toBeNull();
  });
  it('usa regra salva da escola', () => {
    expect(categoryFromDescriptionPrefix('Conservação e Manutenção', mem, known)).toBe('Conservação /Melhorias');
  });
  it('acha linha só com nome repetida', () => {
    const rows = [
      { data: '2026-10-06', valor: 3339.21, descricao: 'Salário Instrutores - Bianca Barbosa de Almeida' },
      { data: '2026-10-06', valor: 3339.21, descricao: 'Bianca Barbosa de Almeida' },
      { data: '2026-10-06', valor: 150, descricao: 'Bruno Vilela' },
    ];
    expect(findNameOnlyDuplicates(rows).map(r => r.descricao)).toEqual(['Bianca Barbosa de Almeida']);
  });
});
