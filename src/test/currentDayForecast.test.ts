import { describe, it, expect } from 'vitest';
import { buildDailyRows, closingEstimate } from '@/lib/dailyFlow';
import { buildMonthMovement, type PeriodMovementCtx } from '@/lib/periodMovement';
import { projectCashRisk } from '@/lib/cashRisk';
import type { ProjectedEntry } from '@/lib/projectionEngine';

const today = '2026-11-05';
function entry(id: string, valor: number, tipo: 'entrada' | 'saida', origem: ProjectedEntry['origem'], data = today, categoria = tipo === 'entrada' ? 'Receita' : 'Despesa'): ProjectedEntry {
  return { id, school_id: 'test', data, dataProjetada: data, descricao: id, valor, tipo, origem, categoria,
    tipoOriginal: categoria, tipoRegistro: origem === 'fluxo' ? 'realizado' : 'projetado', editadoManualmente: false,
    impacto: tipo === 'entrada' ? valor : -valor };
}
const projected = [entry('receber', 978.54, 'entrada', 'sponte'), entry('salarios', 30116.48, 'saida', 'contas_pagar')];
const realized = [entry('recebido', 408.10, 'entrada', 'fluxo')];
function rows(p = projected, r = realized, date = today) {
  return buildDailyRows({ allDays: ['2026-11-04', today, '2026-11-06'], priorSaldo: 35012.04,
    projected: p, realized: r, classifications: [], historicalRows: [], monthSources: { '2026-11': 'fluxo' }, modelItems: [], todayStr: date });
}
function ctx(entries = [...projected, ...realized]): PeriodMovementCtx {
  return { entries, historicalRows: [], snapshotMap: new Map(), classifications: [], modelItems: [],
    saldoInicialBase: 35012.04, saldoInicialBaseDate: '2026-11-01', todayStr: today };
}
describe('previsão pendente do dia atual', () => {
  it('Champagnat: salários de R$ 30.116,48 ainda reduzem o saldo de hoje', () => {
    const day = rows()[1];
    expect(day.saldoFinalRealizado).toBeCloseTo(35420.14, 2);
    expect(day.saldoFinalProjecao).toBeCloseTo(5874.10, 2);
    expect(closingEstimate(rows()).entrada).toBeCloseTo(978.54, 2);
    expect(closingEstimate(rows()).saida).toBeCloseTo(30116.48, 2);
  });
  it('fechamento mensal usa a mesma previsão pendente, sem duplicar entrada realizada', () => {
    const movement = buildMonthMovement('2026-11', ctx());
    expect(movement.receitas).toBeCloseTo(978.54, 2);
    expect(movement.despesas).toBeCloseTo(30116.48, 2);
    expect(movement.receitasRealizadas).toBeCloseTo(408.10, 2);
    expect(35012.04 + movement.saldoMovimento).toBeCloseTo(5874.10, 2);
  });
  it('pagamento parcial abate apenas o valor já pago', () => {
    const paid = [...realized, entry('salario-pago', 10000, 'saida', 'fluxo')];
    expect(rows(projected, paid)[1].saldoFinalProjecao).toBeCloseTo(5874.10, 2);
    expect(buildMonthMovement('2026-11', ctx([...projected, ...paid])).despesas).toBeCloseTo(30116.48, 2);
  });
  it('quando todo salário saiu não duplica nem usa previsão negativa', () => {
    const paid = [...realized, entry('salario-pago', 31000, 'saida', 'fluxo')];
    expect(rows(projected, paid)[1].saldoFinalProjecao).toBeCloseTo(4990.58, 2);
    expect(buildMonthMovement('2026-11', ctx([...projected, ...paid])).despesas).toBeCloseTo(31000, 2);
  });
  it('não ressuscita previsão de dia passado com realizado', () => {
    expect(rows(projected, realized, '2026-11-06')[1].saldoFinalProjecao).toBeCloseTo(35420.14, 2);
    expect(buildMonthMovement('2026-11', { ...ctx(), todayStr: '2026-11-06' }).despesas).toBe(0);
  });
  it('sem realizado ainda considera toda a previsão', () => {
    expect(rows(projected, [])[1].saldoFinalProjecao).toBeCloseTo(35874.10 - 30116.48, 2);
  });
  it('operações não abatem salários nem entram em receita/despesa', () => {
    const operations = [entry('emprestimo-previsto', 1000, 'entrada', 'sponte', today, 'Entrada Empréstimo')];
    const actual = [...realized, entry('emprestimo-recebido', 400, 'entrada', 'fluxo', today, 'Entrada Empréstimo')];
    const movement = buildMonthMovement('2026-11', ctx([...projected, ...operations, ...actual]));
    expect(movement.operacoesIn).toBe(1000);
    expect(movement.receitas).toBeCloseTo(978.54, 2);
    expect(rows([...projected, ...operations], actual)[1].saldoFinalProjecao).toBeCloseTo(6874.10, 2);
  });
});