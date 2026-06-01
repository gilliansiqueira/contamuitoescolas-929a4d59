/**
 * SSOT - Single Source of Truth para projeção financeira.
 *
 * Toda tela que exibe valores (Dashboard, Fluxo Diário, Fluxo, Recebíveis,
 * Calendário, Dados, Relatórios, Indicadores) DEVE consumir esta camada.
 *
 * Pipeline canônico:
 *   1. filterActiveEntries  → remove categorias marcadas como 'ignorar'
 *   2. gate do Modelo Financeiro → tipos fora do modelo são descartados
 *   3. applyPaymentDelay → desloca SOMENTE entries projetados de origem 'sponte'
 *      pelo prazo configurado em payment_delay_rules
 *   4. anexa { dataProjetada, impacto } via getSaldoImpact
 *
 * Importante:
 *  - Realizado nunca tem data deslocada.
 *  - Apenas origem 'sponte' tem prazo aplicado (regra do produto).
 *  - Sponte Pay também é Sponte; o prazo da forma de cobrança "Sponte Pay"
 *    é aplicado normalmente quando configurado em "Prazos de cobrança".
 */

import type { FinancialEntry, TypeClassification, PaymentDelayRule } from '@/types/financial';
import { filterActiveEntries, getSaldoImpact, getEffectiveClassification } from './classificationUtils';
import { addDaysAndAdjust } from './dateUtils';

export interface ProjectedEntry extends FinancialEntry {
  /** Data ajustada pelo prazo de cobrança (se aplicável). Senão === entry.data */
  dataProjetada: string;
  /** Impacto efetivo no saldo conforme classificação (positivo, negativo ou 0) */
  impacto: number;
}

/**
 * Aplica prazo de cobrança a uma entry projetada de origem 'sponte'.
 * Demais entries retornam a data original inalterada.
 */
export function applyPaymentDelay(
  entry: FinancialEntry,
  rules: PaymentDelayRule[]
): string {
  if (entry.tipoRegistro !== 'projetado') return entry.data;
  if (entry.origem !== 'sponte') return entry.data;
  const forma = (entry.categoria || '').toLowerCase();
  if (!forma) return entry.data;
  const rule = rules.find(r => forma.includes(r.formaCobranca.toLowerCase()));
  if (!rule || rule.prazo === 0) return entry.data;
  return addDaysAndAdjust(entry.data, rule.prazo);
}

export interface ProjectEntriesOptions {
  /** Gate do modelo financeiro. Pular se a escola não tem modelo atribuído. */
  hasModel: boolean;
  isInModel: (label: string) => boolean;
}

/**
 * Pipeline canônico. Retorna entries enriquecidas com dataProjetada e impacto.
 */
export function projectEntries(
  entries: FinancialEntry[],
  rules: PaymentDelayRule[],
  classifications: TypeClassification[],
  options: ProjectEntriesOptions
): ProjectedEntry[] {
  // 1) ignora 'ignorar'
  let active = filterActiveEntries(entries, classifications);

  // 2) gate do modelo
  if (options.hasModel) {
    active = active.filter(e => {
      const cls = getEffectiveClassification(e, classifications);
      if (cls === 'operacao') return true;
      return options.isInModel(e.tipoOriginal || e.categoria || e.tipo);
    });
  }

  // 3 + 4) prazo + impacto
  return active.map(e => {
    const dataProjetada = applyPaymentDelay(e, rules);
    const impacto = getSaldoImpact(e, classifications);
    return { ...e, dataProjetada, impacto };
  });
}
