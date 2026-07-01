/**
 * Strict normalization of payment method labels coming from Sponte (and
 * variations) into canonical keys used by the audit engine.
 *
 * RULES (immutáveis):
 *  - Dinheiro permanece Dinheiro. Nunca vira Cobrança/Boleto/Sponte Pay.
 *  - Cartão de Crédito permanece Cartão de Crédito.
 *  - Cartão de Débito permanece Cartão de Débito (nunca tratado como crédito,
 *    nunca usa o delay de crédito).
 *  - PIX permanece PIX.
 *  - Cheque permanece Cheque.
 *  - Cheque Pré-Datado permanece Cheque Pré-Datado (chave própria).
 *  - Sponte Pay permanece Sponte Pay.
 *  - Boleto Sponte Pay permanece Boleto Sponte Pay (chave própria, distinta de Sponte Pay).
 *
 * O wizard recusa prosseguir se uma linha trouxer método desconhecido.
 */

export type PaymentMethodKey =
  | 'credito'
  | 'debito'
  | 'pix'
  | 'boleto'
  | 'cheque'
  | 'cheque_pre_datado'
  | 'dinheiro'
  | 'sponte_pay'
  | 'boleto_sponte_pay';

export interface PaymentMethodMeta {
  key: PaymentMethodKey;
  label: string;
  /** Whether this method is subject to payment-delay rules (Sponte). */
  delayApplicable: boolean;
}

export const PAYMENT_METHODS: Record<PaymentMethodKey, PaymentMethodMeta> = {
  credito: { key: 'credito', label: 'Cartão de Crédito', delayApplicable: true },
  debito: { key: 'debito', label: 'Cartão de Débito', delayApplicable: false },
  pix: { key: 'pix', label: 'PIX', delayApplicable: true },
  boleto: { key: 'boleto', label: 'Boleto', delayApplicable: true },
  cheque: { key: 'cheque', label: 'Cheque', delayApplicable: true },
  cheque_pre_datado: { key: 'cheque_pre_datado', label: 'Cheque Pré-Datado', delayApplicable: true },
  dinheiro: { key: 'dinheiro', label: 'Dinheiro', delayApplicable: false },
  sponte_pay: { key: 'sponte_pay', label: 'Sponte Pay', delayApplicable: true },
  boleto_sponte_pay: { key: 'boleto_sponte_pay', label: 'Boleto Sponte Pay', delayApplicable: true },
};

export const PAYMENT_METHOD_ORDER: PaymentMethodKey[] = [
  'credito',
  'debito',
  'pix',
  'boleto',
  'cheque',
  'cheque_pre_datado',
  'dinheiro',
  'sponte_pay',
  'boleto_sponte_pay',
];

function norm(s: string): string {
  return (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve a raw method string to a canonical key. Returns `null` when no rule
 * matches — caller MUST treat this as a blocking error.
 *
 * Order matters: more specific labels (Boleto Sponte Pay, Sponte Pay,
 * Cheque Pré-Datado) ANTES de variantes mais amplas (Boleto, Cheque).
 */
export function resolveMethodKey(raw: string): PaymentMethodKey | null {
  const n = norm(raw);
  if (!n) return null;

  // Mais específicos primeiro.
  if (n.includes('boleto sponte') || n.includes('boleto-sponte')) return 'boleto_sponte_pay';
  if (n.includes('sponte pay') || n === 'spontepay' || n === 'sponte') return 'sponte_pay';

  if (n.includes('pre datado') || n.includes('pre-datado') || n.includes('predatado')) {
    return 'cheque_pre_datado';
  }

  // Crédito vs débito — nunca colapsar.
  if (n.includes('credito') || n.includes('credit')) return 'credito';
  if (n.includes('debito') || n.includes('debit')) return 'debito';

  if (n.includes('pix')) return 'pix';
  // Transferência bancária / TED / DOC / depósito → agrupados com PIX
  // (mesma categoria de recebível, mesma regra de delay).
  if (
    n.includes('transferencia') ||
    n.includes('transferência') ||
    n === 'ted' || n.startsWith('ted ') ||
    n === 'doc' || n.startsWith('doc ') ||
    n.includes('deposito') || n.includes('depósito')
  ) return 'pix';
  if (n.includes('boleto') || n.includes('cobranca') || n.includes('cobrança')) return 'boleto';
  if (n.includes('cheque')) return 'cheque';
  if (n.includes('dinheiro') || n.includes('especie') || n.includes('espécie') || n === 'cash') {
    return 'dinheiro';
  }
  return null;
}

export function methodLabel(key: PaymentMethodKey): string {
  return PAYMENT_METHODS[key].label;
}
