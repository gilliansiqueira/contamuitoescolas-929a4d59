/** Alerta de caixa negativo: regra pura (testada). */
function addDays(d: string, n: number): string {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export interface CashRiskResult {
  baseDate: string;
  baseBalance: number;
  firstNegativeDate: string | null;
  minBalance: number;
}

/**
 * Parte do saldo do extrato. Um extrato com data final no futuro não pode "pular"
 * os recebimentos projetados desses dias: a data base nunca passa de hoje, então
 * a projeção conta a partir de amanhã (o movimento futuro do extrato vale como previsão).
 */
export function projectCashRisk(
  base: { date: string; balance: number },
  impacts: { date: string; impacto: number }[],
  today: string,
  horizonDays = 15,
): CashRiskResult {
  const baseDate = base.date > today ? today : base.date;
  const byDay = new Map<string, number>();
  for (const i of impacts) {
    if (!i.impacto || i.date <= baseDate) continue;
    byDay.set(i.date, (byDay.get(i.date) ?? 0) + i.impacto);
  }
  let saldo = base.balance;
  let firstNegativeDate: string | null = null;
  let minBalance = Infinity;
  for (let d = addDays(baseDate, 1); d <= addDays(today, horizonDays); d = addDays(d, 1)) {
    saldo += byDay.get(d) ?? 0;
    if (d >= today && saldo < 0) {
      if (!firstNegativeDate) firstNegativeDate = d;
      if (saldo < minBalance) minBalance = saldo;
    }
  }
  return { baseDate, baseBalance: base.balance, firstNegativeDate, minBalance: Math.round(minBalance * 100) / 100 };
}
