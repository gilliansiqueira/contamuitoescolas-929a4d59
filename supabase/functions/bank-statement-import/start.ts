/** Descarta linhas com data anterior ao primeiro dia do mês de início (YYYY-MM) da empresa. */
export function filterRowsFromStart<T extends Record<string, unknown>>(rows: T[], startMonth?: string | null) {
  if (!startMonth || !/^\d{4}-\d{2}$/.test(startMonth)) return { kept: rows, ignored: 0 };
  const start = `${startMonth}-01`;
  const kept = rows.filter(r => typeof r.data !== 'string' || r.data.slice(0, 10) >= start);
  return { kept, ignored: rows.length - kept.length };
}

/** Corte por início só vale para empresas com `school_features.extrato_corte_inicio` ligado (as Wizard). */
export function applyStartCut<T extends Record<string, unknown>>(rows: T[], startMonth: string | null | undefined, enabled: boolean) {
  return enabled ? filterRowsFromStart(rows, startMonth) : { kept: rows, ignored: 0 };
}
