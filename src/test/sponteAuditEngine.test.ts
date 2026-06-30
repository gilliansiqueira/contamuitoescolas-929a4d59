import { describe, it, expect } from 'vitest';
import {
  buildConferenceReport,
  simulateDelays,
  simulateReplacement,
  buildInsertableEntries,
  type ParsedRow,
} from '@/lib/import/sponteAuditEngine';
import { resolveMethodKey } from '@/lib/import/methodMapping';
import type { FinancialEntry, PaymentDelayRule } from '@/types/financial';

const rules: PaymentDelayRule[] = [
  { id: '1', school_id: 's', formaCobranca: 'Cartão de Crédito', prazo: 30 },
  { id: '2', school_id: 's', formaCobranca: 'Cartão de Débito', prazo: 1 },
  { id: '3', school_id: 's', formaCobranca: 'PIX', prazo: 0 },
  { id: '4', school_id: 's', formaCobranca: 'Boleto', prazo: 1 },
  { id: '5', school_id: 's', formaCobranca: 'Sponte Pay', prazo: 30 },
];

function row(o: Partial<ParsedRow> & { v: number; data: string; metodo: string }, line = 1): ParsedRow {
  return {
    lineNumber: line,
    dataVencimento: o.data,
    valor: o.v,
    metodoRaw: o.metodo,
    metodoKey: resolveMethodKey(o.metodo),
    nomeAluno: o.nomeAluno,
  };
}

describe('resolveMethodKey', () => {
  it('separates credit and debit', () => {
    expect(resolveMethodKey('Cartão de Crédito')).toBe('credito');
    expect(resolveMethodKey('Cartão de Débito')).toBe('debito');
    expect(resolveMethodKey('cartao credito')).toBe('credito');
  });
  it('preserva identidade de Sponte Pay vs Boleto Sponte Pay', () => {
    expect(resolveMethodKey('Boleto Sponte Pay')).toBe('boleto_sponte_pay');
    expect(resolveMethodKey('Sponte Pay')).toBe('sponte_pay');
  });
  it('preserva Cheque Pré-Datado separado de Cheque', () => {
    expect(resolveMethodKey('Cheque Pré-Datado')).toBe('cheque_pre_datado');
    expect(resolveMethodKey('Cheque')).toBe('cheque');
  });
  it('returns null for unknown', () => {
    expect(resolveMethodKey('Xyz')).toBeNull();
  });
});

describe('buildConferenceReport', () => {
  it('matches file total against system total per method', () => {
    const file = [
      row({ v: 100, data: '2026-07-10', metodo: 'PIX' }),
      row({ v: 200, data: '2026-07-15', metodo: 'Cartão de Crédito' }),
    ];
    const sistema: FinancialEntry[] = [{
      id: 'x', data: '2026-07-15', descricao: '', valor: 200, tipo: 'entrada',
      categoria: 'Cartão de Crédito', origem: 'sponte', school_id: 's',
      tipoRegistro: 'projetado', editadoManualmente: false,
    }];
    const r = buildConferenceReport(file, sistema);
    expect(r.totalArquivo).toBe(300);
    expect(r.totalSistema).toBe(200);
    expect(r.diferencaTotal).toBe(100);
    const pix = r.perMethod.find(l => l.method === 'pix')!;
    expect(pix.diferencaValor).toBe(100);
  });
});

describe('simulateDelays', () => {
  it('shifts credit by 30 days', () => {
    const r = simulateDelays([row({ v: 100, data: '2026-07-10', metodo: 'Cartão de Crédito' })], rules);
    expect(r.errors).toHaveLength(0);
    expect(Object.keys(r.depois)).toContain('2026-08');
  });
  it('respects user-configured delay for any method (including débito)', () => {
    const r = simulateDelays(
      [row({ v: 100, data: '2026-07-10', metodo: 'Cartão de Débito' })],
      [{ id: 'x', school_id: 's', formaCobranca: 'Cartão de Débito', prazo: 2 }],
    );
    expect(r.errors).toHaveLength(0);
    expect(r.movimentos[0].prazoDias).toBe(2);
  });
  it('respects user-configured delay for dinheiro when set', () => {
    const r = simulateDelays(
      [row({ v: 100, data: '2026-07-10', metodo: 'Dinheiro' })],
      [{ id: 'x', school_id: 's', formaCobranca: 'Dinheiro', prazo: 1 }],
    );
    expect(r.errors).toHaveLength(0);
    expect(r.movimentos[0].prazoDias).toBe(1);
  });

  it('pushes weekend dates to monday', () => {
    // 2026-06-28 is a Sunday
    const r = simulateDelays([row({ v: 50, data: '2026-06-28', metodo: 'PIX' })], rules);
    const m = r.movimentos[0];
    expect(m.dataAjustada).toBe('2026-06-29');
  });
});

describe('simulateReplacement', () => {
  it('reports zero balance when totals match', () => {
    const existing: FinancialEntry[] = [{
      id: 'a', data: '2026-07-15', descricao: '', valor: 100, tipo: 'entrada',
      categoria: 'PIX', origem: 'sponte', school_id: 's',
      tipoRegistro: 'projetado', editadoManualmente: false,
    }];
    const sim = simulateReplacement(
      existing,
      [row({ v: 100, data: '2026-07-15', metodo: 'PIX' })],
      { origem: 'sponte', desde: '2026-07-01' },
    );
    expect(sim.bloqueia).toBe(false);
    expect(sim.saldoEsperado).toBe(0);
  });
  it('blocks when difference is non-zero', () => {
    const sim = simulateReplacement(
      [],
      [row({ v: 50, data: '2026-07-15', metodo: 'PIX' })],
      { origem: 'sponte', desde: '2026-07-01' },
    );
    expect(sim.bloqueia).toBe(true);
  });
});

describe('buildInsertableEntries', () => {
  it('stamps rastreabilidade fields', () => {
    const e = buildInsertableEntries(
      [row({ v: 100, data: '2026-07-10', metodo: 'Cartão de Crédito', nomeAluno: 'X' })],
      { schoolId: 's', uploadId: 'u', fileName: 'sponte.xlsx', rules },
    );
    expect(e[0].data_original).toBe('2026-07-10');
    expect(e[0].payment_method_key).toBe('credito');
    expect(e[0].source_file).toBe('sponte.xlsx');
    expect(e[0].delay_rule_applied?.days).toBe(30);
  });
});
