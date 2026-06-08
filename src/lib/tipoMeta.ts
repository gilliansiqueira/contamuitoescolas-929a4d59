import { resolveLedgerRule, normalizeTipo, type ModelItemRule } from './ledgerEngine';
import type { TypeClassification } from '@/types/financial';

export type Classificacao = 'receita' | 'despesa' | 'operacao' | 'ignorar';
export type Sinal = 'somar' | 'subtrair';

export interface TipoMeta {
  classificacao: Classificacao;
  sinal: Sinal;
  entraNoResultado: boolean;
  impactaCaixa: boolean;
  isEntrada: boolean;
  label: string;
  canonicalKey: string;
}

/**
 * Roteador de metadados do Dashboard e fluxo diário.
 *
 * Constrói e padroniza a resposta baseando-se estritamente nas propriedades
 * genéricas retornadas pelo Ledger Engine central. Aceita opcionalmente os
 * itens do Modelo Financeiro da escola como fallback de classificação.
 */
export function resolveTipoMeta(
  tipoKey: string,
  classifications: TypeClassification[],
  modelItems: ModelItemRule[] = []
): TipoMeta {
  const rule = resolveLedgerRule(tipoKey, classifications, modelItems);

  // Deriva o Classificacao textual compatível com a UI a partir da regra do Ledger
  let classificacao: Classificacao = 'ignorar';
  if (rule.entraNoResultado) {
    classificacao = rule.operacaoSinal === 'somar' ? 'receita' : 'despesa';
  } else if (rule.impactaCaixa) {
    classificacao = 'operacao';
  }

  return {
    classificacao,
    sinal: rule.operacaoSinal,
    entraNoResultado: rule.entraNoResultado,
    impactaCaixa: rule.impactaCaixa,
    isEntrada: rule.operacaoSinal === 'somar',
    label: rule.label || tipoKey,
    canonicalKey: normalizeTipo(tipoKey)
  };
}

