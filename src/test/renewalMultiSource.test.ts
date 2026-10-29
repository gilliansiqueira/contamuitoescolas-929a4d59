import { describe, it, expect } from 'vitest';
import { mergeContasImports, complementTurmas } from '@/lib/renewal/multiSource';

describe('vários Contas a Receber (Sponte + Omni)', () => {
  const sponte = [{ Sacado: 'Ana Lúcia', DataVencimento: '25/10/2026 00:00:00', Valor: '594,0000', Categoria: 'Mensalidade Regular' }];
  const omni = [
    { Sacado: 'ana lucia', DataVencimento: '25/10/2026', Valor: 594, Categoria: 'Parcelas de módulo' },
    { Sacado: 'Bruno', DataVencimento: '01/11/2026', Valor: 495, Categoria: 'Parcelas de módulo' },
  ];
  it('mesma parcela nos dois sistemas conta uma vez', () => expect(mergeContasImports([omni, sponte])).toHaveLength(2));
  it('parcelas iguais dentro do mesmo arquivo são mantidas', () => expect(mergeContasImports([[omni[1], omni[1]]])).toHaveLength(2));
});

describe('turmas de outro sistema só completam vazios', () => {
  const base = [{ Aluno: 'Ana', NumeroMatricula: '10', Professor: '', FoneCelular: '11' }];
  const other = [{ Aluno: 'Ana', NumeroMatricula: '10', Professor: 'Matheus', FoneCelular: '99' }, { Aluno: 'Novo', NumeroMatricula: '20', Professor: 'X' }];
  const r = complementTurmas(base, other);
  it('preenche professor vazio', () => expect(r[0].Professor).toBe('Matheus'));
  it('não troca telefone existente', () => expect(r[0].FoneCelular).toBe('11'));
  it('não adiciona alunos', () => expect(r).toHaveLength(1));
});

import { inOtherTurmas } from '@/lib/renewal/multiSource';
describe('aluno nas turmas do outro sistema', () => {
  const f = inOtherTurmas([{ Aluno: 'Alice Guerrini Ramos', NumeroMatricula: 'MAT-000800' }]);
  it('não é pendência quando está no Omni (nome ou matrícula)', () => {
    expect(f({ aluno: 'alice guerrini ramos', matricula: null })).toBe(true);
    expect(f({ aluno: 'Outro', matricula: 'MAT-000800' })).toBe(true);
  });
  it('continua pendência quando não está em nenhum', () => {
    expect(f({ aluno: 'Fulano', matricula: '123' })).toBe(false);
  });
});
