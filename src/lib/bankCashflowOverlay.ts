import type { FinancialEntry } from '@/types/financial';

export const IGNORADO_ENTRADA = 'Movimentações ignoradas (banco) - entrada';
export const IGNORADO_SAIDA = 'Movimentações ignoradas (banco) - saída';
export const AJUSTE_ENTRADA = 'Ajuste de saldo inicial (banco) - entrada';
export const AJUSTE_SAIDA = 'Ajuste de saldo inicial (banco) - saída';

/** Dia anterior a 'YYYY-MM-DD'. */
export function dayBefore(d: string): string {
  const dt = new Date(`${d}T12:00:00Z`); dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export interface CashflowOverlayRow {
  id: string; data: string; descricao: string; valor: number; tipo: 'entrada' | 'saida'; tipo_nome: string;
}

/**
 * Troca de fonte (reversível, só em memória): a partir de `startDate`, o
 * realizado da planilha (origem 'fluxo') sai do cálculo e entra o realizado do
 * Fluxo de Caixa bancário, no mesmo formato. Nada é gravado; projeções e meses
 * anteriores ficam exatamente como estão. Os motores oficiais (SSOT) recebem
 * as linhas normalmente — "A classificar" segue a regra de não classificado.
 */
export function applyCashflowOverlay(
  entries: FinancialEntry[], cashflow: CashflowOverlayRow[], startDate: string, schoolId: string,
): FinancialEntry[] {
  // Todo realizado antigo (planilha e lançamentos manuais) sai do cálculo a partir do corte.
  const kept = entries.filter(e => !((e.tipoRegistro ?? 'realizado') === 'realizado' && e.data >= startDate));
  const added: FinancialEntry[] = cashflow.filter(c => c.data >= startDate).map(c => ({
    id: `bcf-${c.id}`,
    data: c.data,
    descricao: c.descricao,
    valor: Math.abs(Number(c.valor)),
    tipo: c.tipo,
    categoria: 'fluxo_realizado',
    origem: 'fluxo' as FinancialEntry['origem'],
    school_id: schoolId,
    // "Ignorar" no banco: fora do Resultado, mas mexe no saldo (o dinheiro passou pela conta).
    tipoOriginal: c.tipo_nome === 'Ignorar' ? (c.tipo === 'entrada' ? IGNORADO_ENTRADA : IGNORADO_SAIDA) : c.tipo_nome,
    tipoRegistro: 'realizado',
    editadoManualmente: false,
  } as FinancialEntry));
  return [...kept, ...added].sort((a, b) => a.data.localeCompare(b.data));
}
