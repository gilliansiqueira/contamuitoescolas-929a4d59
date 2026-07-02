/**
 * SSOT - Single Source of Truth para projeção financeira.
 *
 * Toda tela que exibe valores (Dashboard, Fluxo Diário, Fluxo, Recebíveis,
 * Calendário, Dados, Relatórios, Indicadores) DEVE consumir esta camada.
 *
 * Pipeline canônico:
 *   1. gate do Modelo Financeiro → tipos fora do modelo são descartados
 *      (EXCEÇÃO: entries de origem 'contas_pagar' nunca são filtradas).
 *   2. applyPaymentDelay → desloca SOMENTE entries projetados de origem 'sponte'
 *      pelo prazo configurado em payment_delay_rules
 *   3. anexa { dataProjetada, impacto } via getSaldoImpact
 *
 * Importante:
 *  - O filtro de categorias "ignorar" NÃO é aplicado aqui. Ele só é válido
 *    nos contextos de Fluxo de Caixa Realizado e Histórico Financeiro
 *    (ver snapshotUtils). Projeção, Dashboard, Fluxo Diário, Recebíveis e
 *    Calendário incluem todos os registros.
 *  - Realizado nunca tem data deslocada.
 *  - Apenas origem 'sponte' tem prazo aplicado (regra do produto).
 *  - Origem 'contas_pagar' nunca é filtrada por modelo ou categoria.
 */

import type { FinancialEntry, TypeClassification, PaymentDelayRule } from '@/types/financial';
import { getSaldoImpact, getEffectiveClassification } from './classificationUtils';
import { addDaysAndAdjust, toPreviousBusinessDay } from './dateUtils';
import { normalizeTipo } from './ledgerEngine';

export interface ProjectedEntry extends FinancialEntry {
  /** Data ajustada pelo prazo de cobrança (se aplicável). Senão === entry.data */
  dataProjetada: string;
  /** Impacto efetivo no saldo conforme classificação (positivo, negativo ou 0) */
  impacto: number;
}

/**
 * Localiza a regra de prazo aplicável a uma forma de pagamento (Sponte).
 * Faz match com normalização (sem acento / minúsculas) e tolera variações
 * como "cartão de crédito", "cartao credito", "credito".
 */
function findDelayRule(forma: string, rules: PaymentDelayRule[]): PaymentDelayRule | undefined {
  const f = normalizeTipo(forma);
  if (!f) return undefined;
  // 1) match direto por substring normalizada
  let rule = rules.find(r => {
    const k = normalizeTipo(r.formaCobranca);
    return k && (f.includes(k) || k.includes(f));
  });
  if (rule) return rule;
  // 2) heurística: se contém "credito" → procura regra cartão de crédito
  if (f.includes('credito')) {
    rule = rules.find(r => {
      const k = normalizeTipo(r.formaCobranca);
      return k.includes('credito');
    });
  }
  return rule;
}

/**
 * Aplica prazo de cobrança a uma entry projetada de origem 'sponte'.
 * Demais entries retornam a data original inalterada.
 *
 * Cartões da maquininha (origem 'cartao') usam o vencimento original — não
 * passam por esta função.
 */
export function applyPaymentDelay(
  entry: FinancialEntry,
  rules: PaymentDelayRule[]
): string {
  if (entry.tipoRegistro !== 'projetado') return entry.data;
  if (entry.origem !== 'sponte') return entry.data;
  const forma = entry.categoria || '';
  if (!forma) return entry.data;
  const rule = findDelayRule(forma, rules);
  const prazo = rule?.prazo ?? 0;
  const dataFinal = prazo > 0 ? addDaysAndAdjust(entry.data, prazo) : entry.data;
  // Debug para validação de prazos por forma de cobrança (Sponte)
  if (normalizeTipo(forma).includes('credito')) {
    // eslint-disable-next-line no-console
    console.debug('[PaymentDelay]', {
      origem: entry.origem,
      tipo_pagamento: forma,
      data_vencimento: entry.data,
      prazo_aplicado: prazo,
      data_prevista: dataFinal,
      regra: rule?.formaCobranca ?? '(nenhuma)',
    });
  }
  return dataFinal;
}

export interface ProjectEntriesOptions {
  /** Gate do modelo financeiro. Pular se a escola não tem modelo atribuído. */
  hasModel: boolean;
  isInModel: (label: string) => boolean;
}

/**
 * Pipeline canônico. Retorna entries enriquecidas com dataProjetada e impacto.
 *
 * NÃO filtra categorias "ignorar" — essa regra vale apenas para Fluxo de
 * Caixa Realizado e Histórico Financeiro (ver snapshotUtils).
 */
export function projectEntries(
  entries: FinancialEntry[],
  rules: PaymentDelayRule[],
  classifications: TypeClassification[],
  options: ProjectEntriesOptions
): ProjectedEntry[] {
  let active = entries;

  // 1) gate do modelo — origens de upload nativo (sponte/cheque/cartao/contas_pagar)
  // SEMPRE passam: elas são classificadas pelo `tipo` nativo, não pelo nome da
  // categoria, então não devem ser barradas pelo modelo financeiro.
  const ORIGENS_BYPASS_MODELO = new Set(['contas_pagar', 'sponte', 'cheque', 'cartao']);
  if (options.hasModel) {
    active = active.filter(e => {
      if (ORIGENS_BYPASS_MODELO.has(e.origem)) return true;
      const cls = getEffectiveClassification(e, classifications);
      if (cls === 'operacao') return true;
      if (cls === 'despesa' || cls === 'receita') {
        if (options.isInModel(cls)) return true;
      }
      return options.isInModel(e.tipoOriginal || e.categoria || e.tipo);
    });
  }

  // 2 + 3) prazo + impacto
  return active.map(e => {
    const dataProjetada = applyPaymentDelay(e, rules);
    const impacto = getSaldoImpact(e, classifications);
    return { ...e, dataProjetada, impacto };
  });
}
