import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { parseSponteWorkbook } from '@/lib/renewal/sponteParser';

describe('Omni com várias abas', () => {
  it('acha a aba Alunos mesmo com Resumo primeiro e completa a sala', () => {
    const wb = XLSX.read(readFileSync('src/test/fixtures/omni3abas.xlsx'), { type: 'buffer' });
    expect(wb.SheetNames[0]).toBe('Resumo');
    const sheets = wb.SheetNames.map(n => XLSX.utils.sheet_to_json<any[]>(wb.Sheets[n], { header: 1, raw: true, defval: null }));
    const p = parseSponteWorkbook(sheets);
    expect(p.rows.length).toBe(133);
    expect(new Set(p.rows.map(r => r.Nome)).size).toBe(53);
    const r = p.rows.find(x => x.Aluno === 'Heloisa Bortolozzo Savoldi')!;
    expect(r.Sala).toBe('Sala Personal');
    expect(r.FoneCelular).toBe('419986-2010');
    expect(r.NumeroContrato).toBe('6409/2');
  });
});

import { mergeRows } from '@/lib/renewal/mergeEngine';
describe('turma renomeada', () => {
  it('leva as edições da equipe para a nova turma do mesmo aluno', () => {
    const cols: any[] = [{ id: 'c1', field: null, kind: 'manual', title: 'Obs' }];
    const old: any[] = [{ row_key: '5145|seg qua book 4', imported: {}, overrides: { c1: { value: 'Bolsista/permuta' } }, conflicts: {}, sort_order: 0, manual: false }];
    const imp = new Map([['5145|seg qua 10 00 book 4 teens', { aluno: 'Bruna' }]]);
    const { rows, stats } = mergeRows(old, imp, cols);
    expect(rows).toHaveLength(1);
    expect(rows[0].row_key).toBe('5145|seg qua 10 00 book 4 teens');
    expect(rows[0].overrides.c1.value).toBe('Bolsista/permuta');
    expect(stats.renamed).toEqual(['5145|seg qua book 4']);
  });
});
