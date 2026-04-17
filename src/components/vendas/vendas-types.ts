export type PaymentMethod = 'credit' | 'debit' | 'pix' | 'boleto' | 'check' | 'cash';
export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex';

export interface SalesPaymentMethod {
  id: string;
  school_id: string;
  method_key: string;
  label?: string;
  enabled: boolean;
  sort_order?: number;
}

export interface SalesData {
  id: string;
  school_id: string;
  month: string;
  method_key: string;
  brand_id: string | null;
  value: number;
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'credit', label: 'Cartão de Crédito' },
  { value: 'debit', label: 'Cartão de Débito' },
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'check', label: 'Cheque' },
  { value: 'cash', label: 'Dinheiro' },
];

export const CARD_BRANDS: { value: CardBrand; label: string }[] = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'elo', label: 'Elo' },
  { value: 'amex', label: 'American Express' },
];
