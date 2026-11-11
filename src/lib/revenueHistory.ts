/**
 * Receitas mensais de meses anteriores à plataforma (lidas de relatórios antigos).
 * Só preenchem meses sem movimento na plataforma — nunca somam nem substituem o cálculo oficial.
 */
export interface AnnualRow { year: string; months: (number | null)[] }

export function fillRevenueWithHistory(
  rows: AnnualRow[],
  history: { month: string; value: number }[],
  throughMonth: string,
): { rows: AnnualRow[]; historyMonths: string[] } {
  const historyMonths: string[] = [];
  const byMonth = new Map(history.map(h => [h.month, Number(h.value)]));
  const out = rows.map(row => ({
    year: row.year,
    months: row.months.map((v, i) => {
      if (v !== null) return v;
      const m = `${row.year}-${String(i + 1).padStart(2, '0')}`;
      if (m > throughMonth || !byMonth.has(m)) return null;
      historyMonths.push(m);
      return byMonth.get(m)!;
    }),
  }));
  return { rows: out, historyMonths };
}
