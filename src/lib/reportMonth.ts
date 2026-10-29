/** Mês (YYYY-MM) anterior a `ym`. */
export function prevMonthOf(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * Mês que o Controle de relatórios abre por padrão: o anterior até o dia 20,
 * ou o atual a partir do dia 20 ou quando todos os relatórios do anterior foram entregues.
 * `today` em YYYY-MM-DD (São Paulo).
 */
export function defaultReportMonth(today: string, allPrevDelivered: boolean): string {
  const current = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  if (day >= 20 || allPrevDelivered) return current;
  return prevMonthOf(current);
}
