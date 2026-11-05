/**
 * Lucratividade automática — regra pura, alimentada apenas pelos totais da SSOT
 * (buildMonthMovement: receitas, despesas, operacoesIn, operacoesOut).
 * Nunca usa sinal de valor para classificar.
 */
export type ProfitKey = 'lucro_operacional' | 'lucro_total' | 'lucro_integral';

export const PROFIT_LABELS: Record<ProfitKey, string> = {
  lucro_operacional: 'Lucratividade operacional',
  lucro_total: 'Lucratividade total',
  lucro_integral: 'Lucratividade com receita integral',
};

/** Primeiro mês calculado automaticamente (fechamento de outubro/2026 em diante). */
export const AUTO_PROFIT_START = '2026-10';

export interface MonthTotals {
  receitas: number;
  despesas: number;
  operacoesIn: number;
  operacoesOut: number;
}

const pct = (num: number, den: number) =>
  den > 0 ? Math.round((num / den) * 10000) / 100 : null;

export function computeProfitability(t: MonthTotals, receitaIntegral?: number | null): Record<ProfitKey, number | null> {
  const resultado = t.receitas - t.despesas;
  const integral = receitaIntegral != null && receitaIntegral > 0 ? receitaIntegral : null;
  return {
    lucro_operacional: pct(resultado, t.receitas),
    lucro_total: pct(resultado + t.operacoesIn - t.operacoesOut, t.receitas),
    lucro_integral: integral == null ? null : pct(integral - t.despesas, integral),
  };
}

/** Fechamento com receita integral: troca só a receita pelo valor informado. */
export function integralClosing(t: MonthTotals, receitaIntegral: number) {
  return {
    receitas: receitaIntegral,
    despesas: t.despesas,
    resultado: receitaIntegral - t.despesas,
    diferencaReceita: receitaIntegral - t.receitas,
  };
}

export function isAutoProfitMonth(month: string, currentMonth: string) {
  return month >= AUTO_PROFIT_START && month <= currentMonth;
}
