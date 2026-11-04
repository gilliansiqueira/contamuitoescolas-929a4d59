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

import { divergenciaSistemas } from '@/lib/renewal/multiSource';
import { buildImported } from '@/lib/renewal/mergeEngine';
describe('Sponte × Omni', () => {
  it('lista quem está em turma só num sistema', () => {
    const d = divergenciaSistemas([{ Aluno: 'Ana' }, { Aluno: 'Bia' }], [{ Aluno: 'Ana' }, { Aluno: 'Caio', Semestre: '2026/2' }], false);
    expect(d.map(x => x.message)).toEqual(['Caio: está em turma no Omni, mas não no Sponte.', 'Bia: está em turma no Sponte, mas não no Omni.']);
  });
  it('curso pago antes do corte vira "quitado"; a mesma parcela nos dois sistemas conta uma vez', () => {
    const settings = { include_material: false, module_categories: [], separate_modalities: [] };
    const t = [{ Nome: 'B1', Aluno: 'Ana Souza', NumeroMatricula: '10' }];
    const c = [
      { Sacado: 'Ana Souza', NumeroMatricula: '10', DataVencimento: '10/05/2026', Situacao: 'Quitada', Categoria: 'Parcela Regular', Valor: '555' },
      { Sacado: 'Ana Souza', NumeroMatricula: null, DataVencimento: '10/05/2026', DataPagamento: '11/05/2026', Situacao: 'Pago', Categoria: 'Parcela Curso Turmas', Valor: '557,56' },
    ];
    const { issues } = buildImported(t, c, { settings, minDue: '2026-10-01' });
    expect(issues[0].detail).toMatchObject({ quitado: true, parcelas_pagas: 1 });
  });
});

describe('parcelas só antes do corte', () => {
  it('preenchem o pagamento na planilha em vez de "Sem informação"', () => {
    const settings = { include_material: false, module_categories: [], separate_modalities: [] };
    const p = (d: string) => ({ Sacado: 'Ana Souza', NumeroMatricula: null, DataVencimento: d, DataPagamento: d, Situacao: 'Pago', Categoria: 'Parcela Curso Turmas', Valor: '1', FormaCobranca: 'Parcelado' });
    const { rows } = buildImported([{ Nome: 'B1', Aluno: 'Ana Souza', NumeroMatricula: '10' }], [p('10/05/2026'), p('10/06/2026')], { settings, minDue: '2026-10-01' });
    const r: any = [...rows.values()][0];
    expect([r.forma_pagamento_atual, r.venc_ultima_parcela, r.termino_pagamento]).toEqual(['Parcelado', '2026-06-10', '2026-06-10']);
  });
});
