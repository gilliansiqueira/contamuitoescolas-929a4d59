export type PaymentMethod = 'credit' | 'debit' | 'pix' | 'boleto' | 'check' | 'cash';
export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex';

export interface SalesPaymentMethod {
  id: string;
  school_id: string;
  payment_method: PaymentMethod;
  card_brand: CardBrand | null;
  enabled: boolean;
}

export interface SalesData {
  id: string;
  school_id: string;
  month: string;
  payment_method: PaymentMethod;
  card_brand: CardBrand | null;
  amount: number;
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
