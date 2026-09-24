import type { FinancialEntry } from '@/types/financial';

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
  const kept = entries.filter(e => !(e.origem === 'fluxo' && e.data >= startDate));
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
