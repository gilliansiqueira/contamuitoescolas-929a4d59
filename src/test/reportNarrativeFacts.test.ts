import { describe, it, expect } from 'vitest';
import { pctChange, shiftMonth, unknownNumbers, buildProjectionFacts } from '@/lib/reportNarrativeFacts';

describe('reportNarrativeFacts', () => {
  it('queda de receita de 181 mil para 161 mil ≈ 11%', () => {
    expect(pctChange(161042.28, 181042.28)).toBe(-11);
  });
  it('sem base não calcula variação', () => {
    expect(pctChange(100, 0)).toBeNull();
  });
  it('troca de ano no mês anterior', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-09', -12)).toBe('2025-09');
  });
  it('aponta número que não estava nos fatos', () => {
    const facts = 'Mês: receitas R$ 181.042,28. KPI Lucratividade: 12,8%.';
    expect(unknownNumbers('Receitas de R$ 181.042,28 e lucratividade de 12,8%', facts)).toEqual([]);
    expect(unknownNumbers('Receitas de R$ 190.000,00 e lucratividade de 15%', facts)).toEqual(['R$ 190.000,00', '15%']);
  });
});

import { profitabilityFacts } from '@/lib/reportNarrativeFacts';
describe('profitabilityFacts', () => {
  it('com receita integral salva ela é a principal', () => {
    const l = profitabilityFacts({ operacional: 12.82, total: 10, integral: 20.5, receitaIntegral: 200000 });
    expect(l[0]).toContain('receita integral');
    expect(l[0]).toContain('20,50%');
  });
  it('com operações mostra os dois cenários', () => {
    const l = profitabilityFacts({ operacional: 15, total: 8.4, integral: null });
    expect(l).toHaveLength(1);
    expect(l[0]).toContain('15,00%');
    expect(l[0]).toContain('8,40%');
  });
  it('sem operações mostra uma só', () => {
    expect(profitabilityFacts({ operacional: 15, total: 15, integral: null })[0]).toBe('Lucratividade do mês: 15,00%.');
  });
});

import { buildReportFacts } from '@/lib/reportNarrativeFacts';
describe('receita integral no topo', () => {
  it('Sinop: topo usa R$ 152.788,43 e resultado = integral − despesas', () => {
    const l = buildReportFacts({ schoolName: 'Sinop', month: '2026-10', entries: [], classifications: [], kpis: [], receitaIntegral: 152788.43 }).map(x => x.replace(/\u00a0/g, ' '));
    expect(l[1]).toContain('Receitas (integral) R$ 152.788,43');
    expect(l[1]).toContain('resultado R$ 152.788,43');
    expect(l[3]).toContain('100,00%');
  });
});

describe('totais do mês pela mesma fonte do Dashboard', () => {
  it('Sinop: despesas vêm dos totais do mês e resultado = integral − despesas', () => {
    const l = buildReportFacts({ schoolName: 'Sinop', month: '2026-10', entries: [], classifications: [], kpis: [], receitaIntegral: 152788.43,
      totalsFor: m => m === '2026-10' ? { receitas: 140000, despesas: 118475.31 } : { receitas: 0, despesas: 0 } }).map(x => x.replace(/\u00a0/g, ' '));
    expect(l[1]).toContain('despesas R$ 118.475,31');
    expect(l[1]).toContain('resultado R$ 34.313,12');
    expect(l[2]).toContain('R$ 140.000,00');
  });
});

describe('buildProjectionFacts — futuro e simulação', () => {
  it('lista metas da Simulação a partir do mês atual, com total', () => {
    const L = buildProjectionFacts({ schoolName: 'X', closedMonth: '2026-10', entries: [], classifications: [], saldoInicial: 0, today: '2026-11-07',
      simulation: [{ nome: 'Matrículas', quantities: { '2026-10': 99, '2026-11': 10, '2026-12': 15 } }, { nome: 'Renovação', quantities: {} }] });
    const s = L.join('\n');
    expect(s).toContain('- Matrículas: 10 em novembro 2026, 15 em dezembro 2026; total 25.');
    expect(s).not.toContain('99');
    expect(s).not.toContain('Renovação:');
  });
  it('sem Simulação mantém o lembrete', () => {
    const L = buildProjectionFacts({ schoolName: 'X', closedMonth: '2026-10', entries: [], classifications: [], saldoInicial: 0, today: '2026-11-07' });
    expect(L.join('\n')).toContain('[completar cenário de matrículas e renovações]');
  });
});

describe('texto da projeção usa os números do Fluxo Diário', () => {
  it('receitas, despesas, menor saldo e fim do mês vêm do fluxo, não da soma bruta', () => {
    const flow = {
      '2026-11': { entrada: 150000, saida: 120000, days: [['2026-11-08', 900], ['2026-11-09', 5000], ['2026-11-13', 1200.5], ['2026-11-30', 31000]] as [string, number][] },
      '2026-12': { entrada: 0, saida: 0, days: [] },
      '2027-01': { entrada: 0, saida: 0, days: [] },
    };
    const f = buildProjectionFacts({ schoolName: 'X', closedMonth: '2026-10', entries: [], classifications: [], saldoInicial: 0, today: '2026-11-09', flow }).join('\n').replace(/\u00a0/g, ' ');
    expect(f).toContain('receitas R$ 150.000,00, despesas R$ 120.000,00, resultado R$ 30.000,00');
    expect(f).toContain('menor saldo previsto R$ 1.200,50 em 13/11');
    expect(f).toContain('fim do mês R$ 31.000,00');
  });
});
