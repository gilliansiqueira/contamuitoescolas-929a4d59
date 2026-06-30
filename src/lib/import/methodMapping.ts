/**
 * Strict normalization of payment method labels coming from Sponte (and
 * variations) into canonical keys used by the audit engine.
 *
 * Cartão de Crédito ≠ Cartão de Débito. The mapping is intentionally strict:
 * the wizard refuses to proceed if a row carries an unknown method.
 */

export type PaymentMethodKey =
  | 'credito'
  | 'debito'
  | 'pix'
  | 'boleto'
  | 'cheque'
  | 'dinheiro'
  | 'sponte_pay';

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
  dinheiro: { key: 'dinheiro', label: 'Dinheiro', delayApplicable: false },
  sponte_pay: { key: 'sponte_pay', label: 'Sponte Pay', delayApplicable: true },
};

export const PAYMENT_METHOD_ORDER: PaymentMethodKey[] = [
  'credito', 'debito', 'pix', 'boleto', 'cheque', 'dinheiro', 'sponte_pay',
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
 * Order matters: more specific labels (Sponte Pay) before broad ones.
 */
export function resolveMethodKey(raw: string): PaymentMethodKey | null {
  const n = norm(raw);
  if (!n) return null;

  // Sponte Pay first — contains "boleto" sometimes and would otherwise match boleto.
  if (n.includes('sponte pay') || n === 'spontepay' || n.includes('boleto sponte')) {
    return 'sponte_pay';
  }
  // Credit vs debit — never collapse.
  if (n.includes('credito') || n.includes('credit')) return 'credito';
  if (n.includes('debito') || n.includes('debit')) return 'debito';
  if (n.includes('pix')) return 'pix';
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
