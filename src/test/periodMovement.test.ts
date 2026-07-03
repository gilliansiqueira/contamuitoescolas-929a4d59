import { describe, it, expect } from 'vitest';
import {
  buildMonthMovement,
  computeSaldoInicial,
  computeSaldoFinal,
  resolveMonthSource,
  type PeriodMovementCtx,
} from '@/lib/periodMovement';
import type { ProjectedEntry } from '@/lib/projectionEngine';
import type { TypeClassification } from '@/types/financial';

const schoolId = 'test-school';

function e(overrides: Partial<ProjectedEntry> & { data: string; valor: number; tipo: 'entrada' | 'saida'; origem: ProjectedEntry['origem']; }): ProjectedEntry {
  const base: ProjectedEntry = {
    id: overrides.id ?? Math.random().toString(36),
    school_id: schoolId,
    data: overrides.data,
    dataProjetada: overrides.dataProjetada ?? overrides.data,
    descricao: overrides.descricao ?? '',
    valor: overrides.valor,
    tipo: overrides.tipo,
    categoria: overrides.categoria ?? '',
    origem: overrides.origem,
    tipoOriginal: overrides.tipoOriginal,
    tipoRegistro: overrides.tipoRegistro ?? 'realizado',
    editadoManualmente: overrides.editadoManualmente ?? false,
    impacto: overrides.impacto ?? (overrides.tipo === 'entrada' ? overrides.valor : -overrides.valor),
  };
  return { ...base, ...overrides };
}

const emptyCtx = (over: Partial<PeriodMovementCtx> = {}): PeriodMovementCtx => ({
  entries: [],
  historicalRows: [],
  snapshotMap: new Map(),
  classifications: [],
  modelItems: [],
  saldoInicialBase: 0,
  saldoInicialBaseDate: '2026-01-01',
  todayStr: '2026-06-15',
  ...over,
});

describe('periodMovement — SSOT única de movimentação', () => {
  it('mês só com projeção Sponte → receitas = soma Sponte, despesas = 0', () => {
    const ctx = emptyCtx({
      entries: [
        e({ data: '2026-05-10', valor: 1000, tipo: 'entrada', origem: 'sponte', tipoRegistro: 'projetado' }),
        e({ data: '2026-05-20', valor: 500, tipo: 'entrada', origem: 'sponte', tipoRegistro: 'projetado' }),
      ],
    });
    expect(resolveMonthSource('2026-05', ctx)).toBe('projecao');
    const mv = buildMonthMovement('2026-05', ctx);
    expect(mv.receitas).toBe(1500);
    expect(mv.despesas).toBe(0);
    expect(mv.saldoMovimento).toBe(1500);
  });

  it('mês só com histórico → soma histórico', () => {
    const ctx = emptyCtx({
      historicalRows: [
        { month: '2026-03', tipo_valor: 'Receita', valor: 10000 },
        { month: '2026-03', tipo_valor: 'Despesa', valor: 4000 },
      ],
    });
    expect(resolveMonthSource('2026-03', ctx)).toBe('historico');
    const mv = buildMonthMovement('2026-03', ctx);
    expect(mv.receitas).toBe(10000);
    expect(mv.despesas).toBe(4000);
    expect(mv.saldoMovimento).toBe(6000);
  });

  it('mês com fluxo + histórico → histórico é ignorado (sem dupla contagem)', () => {
    const classifications: TypeClassification[] = [
      { id: '1', school_id: schoolId, tipoValor: 'Receita', classificacao: 'receita', entraNoResultado: true, impactaCaixa: true, operacaoSinal: 'somar', label: 'Receita' } as any,
      { id: '2', school_id: schoolId, tipoValor: 'Despesa', classificacao: 'despesa', entraNoResultado: true, impactaCaixa: true, operacaoSinal: 'subtrair', label: 'Despesa' } as any,
    ];
    const ctx = emptyCtx({
      classifications,
      entries: [
        e({ data: '2026-04-05', valor: 8000, tipo: 'entrada', origem: 'fluxo', tipoOriginal: 'Receita' }),
        e({ data: '2026-04-10', valor: 3000, tipo: 'saida', origem: 'fluxo', tipoOriginal: 'Despesa' }),
      ],
      historicalRows: [
        { month: '2026-04', tipo_valor: 'Receita', valor: 99999 },
        { month: '2026-04', tipo_valor: 'Despesa', valor: 99999 },
      ],
    });
    expect(resolveMonthSource('2026-04', ctx)).toBe('fluxo');
    const mv = buildMonthMovement('2026-04', ctx);
    expect(mv.receitas).toBe(8000);
    expect(mv.despesas).toBe(3000);
    expect(mv.saldoMovimento).toBe(5000);
  });

  it('mês com fluxo + projeções PASSADAS de contas_pagar → projeções passadas ignoradas', () => {
    const classifications: TypeClassification[] = [
      { id: '1', school_id: schoolId, tipoValor: 'Receita', classificacao: 'receita', entraNoResultado: true, impactaCaixa: true, operacaoSinal: 'somar', label: 'Receita' } as any,
      { id: '2', school_id: schoolId, tipoValor: 'Despesa', classificacao: 'despesa', entraNoResultado: true, impactaCaixa: true, operacaoSinal: 'subtrair', label: 'Despesa' } as any,
    ];
    const ctx = emptyCtx({
      todayStr: '2026-06-15',
      classifications,
      entries: [
        e({ data: '2026-06-01', valor: 5000, tipo: 'entrada', origem: 'fluxo', tipoOriginal: 'Receita' }),
        e({ data: '2026-06-02', valor: 2000, tipo: 'saida', origem: 'fluxo', tipoOriginal: 'Despesa' }),
        // Projeção passada — NÃO deve contar (fluxo já cobre o passado do mês)
        e({ data: '2026-06-10', valor: 9000, tipo: 'saida', origem: 'contas_pagar', tipoRegistro: 'projetado' }),
        // Projeção futura — deve contar (fluxo ainda não a cobriu)
        e({ data: '2026-06-25', valor: 1000, tipo: 'saida', origem: 'contas_pagar', tipoRegistro: 'projetado' }),
      ],
    });
    const mv = buildMonthMovement('2026-06', ctx);
    expect(mv.receitas).toBe(5000);
    expect(mv.despesas).toBe(3000); // 2000 fluxo + 1000 projeção futura, sem os 9000 passados
  });

  it('cenário Fazenda RG Maio → saldo_final = 3.264,91', () => {
    // Classificações: pro-labore e antecipacao são operações via DEFAULT_MAPPINGS.
    const classifications: TypeClassification[] = [];
    const ctx = emptyCtx({
      saldoInicialBase: 3881.36,
      saldoInicialBaseDate: '2026-05-01',
      todayStr: '2026-05-31',
      classifications,
      entries: [
        // Receita realizada
        e({ data: '2026-05-15', valor: 30615.77, tipo: 'entrada', origem: 'fluxo', tipoOriginal: 'Receita' }),
        // Despesa realizada
        e({ data: '2026-05-20', valor: 53191.37, tipo: 'saida', origem: 'fluxo', tipoOriginal: 'Despesa' }),
        // Antecipação (operação, somar)
        e({ data: '2026-05-05', valor: 23109.15, tipo: 'entrada', origem: 'fluxo', tipoOriginal: 'Antecipação' }),
        // Pró-labore (operação, subtrair) — via DEFAULT_MAPPINGS 'pro-labore'
        e({ data: '2026-05-10', valor: 1150.00, tipo: 'saida', origem: 'fluxo', tipoOriginal: 'pro-labore' }),
      ],
    });
    const mv = buildMonthMovement('2026-05', ctx);
    expect(mv.receitas).toBeCloseTo(30615.77, 2);
    expect(mv.despesas).toBeCloseTo(53191.37, 2);
    expect(mv.operacoesIn).toBeCloseTo(23109.15, 2);
    expect(mv.operacoesOut).toBeCloseTo(1150.00, 2);
    const saldoFinal = computeSaldoFinal('2026-05', ctx);
    expect(saldoFinal).toBeCloseTo(3264.91, 2);
  });

  it('invariante: saldoInicial(M) === saldoFinal(M-1) para meses consecutivos', () => {
    const ctx = emptyCtx({
      saldoInicialBase: 1000,
      saldoInicialBaseDate: '2026-01-01',
      entries: [
        e({ data: '2026-01-15', valor: 500, tipo: 'entrada', origem: 'fluxo' }),
        e({ data: '2026-02-10', valor: 300, tipo: 'saida', origem: 'fluxo' }),
        e({ data: '2026-03-20', valor: 200, tipo: 'entrada', origem: 'fluxo' }),
      ],
    });
    for (const m of ['2026-02', '2026-03', '2026-04']) {
      const sIni = computeSaldoInicial(m, ctx);
      const [y, mm] = m.split('-').map(Number);
      const d = new Date(y, mm - 2, 1);
      const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const sFinPrev = computeSaldoFinal(prev, ctx);
      expect(sIni).toBeCloseTo(sFinPrev, 6);
    }
  });

  it('mês vazio contribui 0 para o saldo', () => {
    const ctx = emptyCtx({
      saldoInicialBase: 500,
      saldoInicialBaseDate: '2026-01-01',
    });
    expect(computeSaldoFinal('2026-06', ctx)).toBe(500);
  });
});
