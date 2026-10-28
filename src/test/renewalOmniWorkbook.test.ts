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
    expect(new Set(p.rows.map(r => r.Nome)).size).toBe(57);
    const r = p.rows.find(x => x.Aluno === 'Heloisa Bortolozzo Savoldi')!;
    expect(r.Sala).toBe('Sala Personal');
    expect(r.FoneCelular).toBe('419986-2010');
    expect(r.NumeroContrato).toBe('6409/2');
  });
});
