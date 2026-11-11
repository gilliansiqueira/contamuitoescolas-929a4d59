/** Faturamento da Análise de Despesas: salvo > receita integral > receita do mês (SSOT). */
export type FaturamentoOrigem = 'salvo' | 'integral' | 'plataforma' | 'vazio';

export function resolveFaturamentoMes(
  salvo: number | null | undefined,
  integral: number | null | undefined,
  receitaPlataforma: number | null | undefined,
): { valor: number; origem: FaturamentoOrigem } {
  if (salvo != null && salvo > 0) return { valor: salvo, origem: 'salvo' };
  if (integral != null && integral > 0) return { valor: integral, origem: 'integral' };
  if (receitaPlataforma != null && receitaPlataforma > 0) return { valor: receitaPlataforma, origem: 'plataforma' };
  return { valor: 0, origem: 'vazio' };
}
