import { describe, it, expect } from 'vitest';
import { calcularBase2025, calcularPrevisao, mesesPrevisao, modelosExpedicoes, valoresExpedicao, type ExpedicaoSimulada } from '@/lib/previsao';

describe('previsao', () => {
  const base = calcularBase2025(
    [{ group_name: 'Caiaques', trip_date: '2025-09-10', paying_people: 10, revenue: 3000 },
     { group_name: 'A classificar', trip_date: '2025-10-01', paying_people: 2, revenue: 10000 },
     { group_name: 'Peru', trip_date: '2025-09-01', paying_people: 5, revenue: 50000 }],
    [{ group_name: 'Caiaques', data: '2025-09-10', tipo: 'despesa', valor: 1000 }],
    { escritorio: 7000, impostoPct: 10 },
  );
  it('usa ticket e custo por pessoa de 2025 e ignora expedições', () => {
    expect(base.premissas.centros.Caiaques.ticket).toBe(300);
    expect(base.premissas.centros.Caiaques.custoPessoa).toBe(100);
    expect((base.pessoas as Record<string, number[]>)['Outros Passeios']).toBeUndefined();
  });
  it('calcula resultado com fixos, impostos e expedições', () => {
    const [set] = calcularPrevisao(base, { ...base.premissas, ajustesMes: { '2026-09': { proLabore: 10000, folha: 4000 } } }, ['2026-09'], { '2026-09': 500 });
    expect(set.receitaEco).toBe(3000);
    expect(set.impostos).toBe(300);
    expect(set.fixos).toBe(7000 + 30000 + 4000 + 16500);
    expect(set.resultado).toBe(3000 + 500 - 1000 - 300 - 57500);
  });
  it('ajuste de público em %', () => {
    const p = { ...base.premissas, centros: { ...base.premissas.centros, Caiaques: { ...base.premissas.centros.Caiaques, ajustePct: 20 } } };
    expect(calcularPrevisao(base, p, ['2027-09'], {})[0].porCentro.Caiaques.pessoas).toBe(12);
  });
  it('meses out/2026 a dez/2027', () => {
    const m = mesesPrevisao('2026-10', '2027-12');
    expect(m.length).toBe(15);
  });
  const meses = ['2026-10', '2026-11', '2026-12'];
  const expedicao: ExpedicaoSimulada = { id: 'e', nome: 'Peru', centro: 'Peru', participantes: 2, ticket: 1000.01, custoPessoa: 500,
    entradasPct: { '2026-10': 50, '2026-11': 50 }, saidasPct: { '2026-12': 100 } };
  it('distribui entradas e saídas independentemente e fecha centavos', () => {
    const v = valoresExpedicao(expedicao, meses);
    expect(v.pronta).toBe(true);
    expect(Object.values(v.entradas).reduce((s, n) => s + n, 0)).toBe(2000.02);
    expect(v.saidas).toEqual({ '2026-12': 1000 });
    const bx = { receita: { '01': 500 }, custo: { '01': 300 } };
    const linhas = calcularPrevisao(base, { ...base.premissas, ajustesMes: { '2027-02': { expCusto: 50 } } }, ['2026-10', '2027-01', '2027-02'], { '2026-10': 200 }, bx);
    expect(linhas[0].novasExpedicoes).toBe(0);
    expect(linhas[0].expedicoes).toBe(200);
    expect(linhas[1].novasExpedicoes).toBe(500);
    expect(linhas[1].custoExpedicoes).toBe(300);
    expect(linhas[2].custoExpedicoes).toBe(50);
  });
  it('não adiciona vendas com zero participantes ou distribuição incompleta', () => {
    expect(valoresExpedicao({ ...expedicao, participantes: 0 }, meses).receita).toBe(0);
    expect(valoresExpedicao({ ...expedicao, entradasPct: { '2026-10': 40 } }, meses).entradas).toEqual({});
    expect(valoresExpedicao({ ...expedicao, custoPessoa: null }, meses).pronta).toBe(false);
    expect(valoresExpedicao({ ...expedicao, saidasPct: { '2028-01': 100 } }, meses).pronta).toBe(false);
  });
  it('preenche modelos ponderados e preserva ausência de custo', () => {
    const modelos = modelosExpedicoes([
      { group_name: 'Peru', trip_date: '2025-01-01', paying_people: 2, revenue: 6000 },
      { group_name: 'Peru', trip_date: '2025-02-01', paying_people: 8, revenue: 16000 },
    ], [{ group_name: 'Peru', data: '2025-01-01', tipo: 'despesa', valor: 10000 }], ['Peru', 'Atacama', 'Caiaques', 'A classificar']);
    expect(modelos).toEqual([
      { centro: 'Peru', participantes: 10, ticket: 2200, custoPessoa: 1000 },
      { centro: 'Atacama', participantes: 0, ticket: null, custoPessoa: null },
    ]);
  });
});

import { valoresMes as _vm } from '@/lib/previsao';
describe('pró-labore e folha por mês', () => {
  const p: any = { proLaboreSocio: 10000, proLaboreSocio2026: 7000, folha: 4000, folha2026: 12481.96, ajustesMes: { '2027-02': { folha: 5000 } } };
  it('usa valores por período e ajuste do mês', () => {
    expect(_vm(p, '2026-12')).toEqual({ proLabore: 7000, folha: 12481.96 });
    expect(_vm(p, '2027-01')).toEqual({ proLabore: 10000, folha: 4000 });
    expect(_vm(p, '2027-02')).toEqual({ proLabore: 10000, folha: 5000 });
  });
});

describe('anos dos valores', () => {
  it('Passeios Locais: público 2025, ticket/custo 2026', () => {
    const b = calcularBase2025(
      [{ group_name: 'Passeios Locais', trip_date: '2025-03-01', paying_people: 10, revenue: 1000 },
       { group_name: 'Passeios Locais', trip_date: '2026-03-01', paying_people: 5, revenue: 1500 }],
      [{ group_name: 'Passeios Locais', data: '2026-03-01', tipo: 'despesa', valor: 500 }],
      { escritorio: 0, impostoPct: 0, anoValores: { 'Passeios Locais': '2026' } });
    expect(b.pessoas['Passeios Locais'][2]).toBe(10);
    expect(b.premissas.centros['Passeios Locais']).toEqual({ ticket: 300, custoPessoa: 100, ajustePct: 0 });
  });
});
