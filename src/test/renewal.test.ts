import { describe, it, expect } from 'vitest';
import { buildImported, mergeRows, defaultMinDue } from '@/lib/renewal/mergeEngine';
import { parseSponteMatrix, toIsoDate } from '@/lib/renewal/sponteParser';
import { columnFromField } from '@/lib/renewal/fields';
import { computeSummary } from '@/lib/renewal/exportXlsx';

const settings = { include_material: false, module_categories: ['Parcela Regular', 'Parcela Especial'], separate_modalities: ['Personal'] };
const turmas = [
  { Nome: 'Seg&Qua Book 1', Professor: 'Ana', Aluno: 'João Silva', NumeroMatricula: '10', Modalidade: 'Normal', IntegrantesAtuais: 2 },
  { Nome: 'Seg&Qua Book 1', Professor: 'Ana', Aluno: 'Maria Souza', NumeroMatricula: '11', Modalidade: 'Normal' },
  { Nome: 'Personal - Pedro', Professor: 'Bia', Aluno: 'Pedro Lima', NumeroMatricula: '12', Modalidade: 'Personal' },
  { Nome: 'Ter Book 2', Professor: 'Bia', Aluno: 'Pedro Lima', NumeroMatricula: '13', Modalidade: 'Normal' },
];
const contas = [
  { Sacado: 'João Silva', NumeroMatricula: '10', DataVencimento: '05/11/2026 00:00:00', Categoria: 'Parcela Regular.', FormaCobranca: 'PIX', Situacao: 'Quitada' },
  { Sacado: 'João Silva', NumeroMatricula: '10', DataVencimento: '05/12/2026 00:00:00', Categoria: 'Material Didático', FormaCobranca: 'PIX' },
  { Sacado: 'João Silva', NumeroMatricula: '10', DataVencimento: '05/01/2027 00:00:00', Categoria: 'Parcela Regular.', FormaCobranca: 'PIX', Situacao: 'Cancelada' },
  { Sacado: 'Maria Souza', NumeroMatricula: '11', DataVencimento: '10/12/2026', Categoria: 'Parcela Regular.', FormaCobranca: 'Cartão de Crédito' },
  { Sacado: 'Pedro Lima', NumeroMatricula: '', DataVencimento: '10/12/2026', Categoria: 'Parcela Regular.', FormaCobranca: 'PIX' },
  { Sacado: 'Joao Silvaa', NumeroMatricula: '99', DataVencimento: '10/12/2026', Categoria: 'Parcela Regular.', FormaCobranca: 'PIX' },
];

describe('renovação escolar', () => {
  it('lê datas do Sponte e descarta linhas de título/total', () => {
    expect(toIsoDate('05/11/2026 00:00:00')).toBe('2026-11-05');
    const p = parseSponteMatrix([['Contas a Receber'], [], ['Sacado', 'DataVencimento', 'Categoria'], ['A', '01/01/2026', 'X'], ['Total', null, null]]);
    expect(p.rows).toHaveLength(1);
    expect(p.discarded).toBe(1);
  });

  it('última parcela só do módulo, sem material nem cancelada; cartão fica a confirmar', () => {
    const { rows, issues } = buildImported(turmas, contas, { settings, minDue: '2026-05-01' });
    const joao = [...rows.values()].find(r => r.aluno === 'João Silva')!;
    expect(joao.venc_ultima_parcela).toBe('2026-11-05');
    const maria = [...rows.values()].find(r => r.aluno === 'Maria Souza')!;
    expect(maria.termino_pagamento).toBe('A confirmar');
    expect(maria.venc_ultima_parcela).toBe('2026-12-10');
    // Pedro tem duas matrículas com o mesmo nome: nome ambíguo, não cruza
    expect(issues.some(i => i.kind === 'nome_ambiguo')).toBe(true);
    expect(issues.some(i => i.kind === 'nome_semelhante')).toBe(true);
    // todos os alunos permanecem; sem parcela = Sem informação
    expect(rows.size).toBe(4);
    const pedro = [...rows.values()].find(r => r.matricula === '12')!;
    expect(pedro.venc_ultima_parcela).toBe('Sem informação');
    expect(pedro.aba).toBe('Personal');
  });

  it('material entra quando a escola liga a opção', () => {
    const { rows } = buildImported(turmas, contas, { settings: { ...settings, include_material: true } });
    expect([...rows.values()].find(r => r.aluno === 'João Silva')!.venc_ultima_parcela).toBe('2026-12-05');
  });

  it('reimportação preserva correção manual e aponta conflito', () => {
    const cols = [columnFromField('venc_ultima_parcela'), columnFromField('observacoes')];
    const first = buildImported(turmas, contas, { settings }).rows;
    const k = [...first.keys()][0];
    const existing = [{ row_key: k, imported: first.get(k)!, sort_order: 0, manual: false, conflicts: {},
      overrides: { [cols[0].id]: { value: '2026-12-31', original: first.get(k)!.venc_ultima_parcela, at: '' }, [cols[1].id]: { value: 'ligar', original: null, at: '' } } }];
    const changed = new Map(first); changed.set(k, { ...first.get(k)!, venc_ultima_parcela: '2027-01-05' });
    const { rows, stats } = mergeRows(existing, changed, cols);
    const r = rows.find(x => x.row_key === k)!;
    expect(r.overrides[cols[1].id].value).toBe('ligar');
    expect(r.conflicts[cols[0].id]).toEqual({ imported: '2027-01-05', manual: '2026-12-31' });
    expect(stats.conflicts).toBe(1);
  });

  it('resumo conta turmas distintas', () => {
    const cols = [columnFromField('professor'), columnFromField('turma')];
    const { rows } = buildImported(turmas, null, { settings });
    const rr = [...rows.entries()].map(([k, v], i) => ({ row_key: k, imported: v, overrides: {}, conflicts: {}, sort_order: i, manual: false }));
    const ana = computeSummary(rr, cols).find(s => s.professor === 'Ana')!;
    expect(ana.turmas).toBe(1);
    expect(ana.alunos).toBe(2);
    expect(defaultMinDue('2026/2')).toBe('2026-05-01');
  });
});

import { applyRenewedFromNextPeriod } from '@/lib/renewal/mergeEngine';
describe('turmas em formação', () => {
  it('marca renovado por matrícula, ignora novos e sinaliza nome ambíguo', () => {
    const rows = new Map<string, Record<string, any>>([
      ['10|a', { aluno: 'Ana Souza', matricula: '10' }],
      ['20|b', { aluno: 'Joao Lima', matricula: '20' }],
      ['30|c', { aluno: 'Joao Lima', matricula: '30' }],
    ]);
    const issues = applyRenewedFromNextPeriod(rows, [
      { Nome: 'KIDS 2', Aluno: 'Ana Souza', NumeroMatricula: '10' },
      { Nome: 'TEENS 1', Aluno: 'Joao Lima', NumeroMatricula: '' },
      { Nome: 'TEENS 1', Aluno: 'Pedro Novo', NumeroMatricula: '99' },
    ]);
    expect(rows.get('10|a')!.status_renovacao).toBe('Rematriculado');
    expect(rows.get('10|a')!.turma_destino).toBe('KIDS 2');
    expect(rows.get('20|b')!.status_renovacao).toBeUndefined();
    expect(issues.map(i => i.kind).sort()).toEqual(['formacao_aluno_novo', 'formacao_nome_semelhante']);
  });
});
