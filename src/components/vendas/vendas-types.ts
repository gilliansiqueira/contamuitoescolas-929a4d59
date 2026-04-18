export type PaymentMethod = 'credito' | 'debito' | 'pix' | 'boleto' | 'cheque' | 'dinheiro';

export interface SalesPaymentMethod {
  id: string;
  school_id: string;
  method_key: string;
  label?: string;
  enabled: boolean;
  sort_order?: number;
}

export interface SalesCardBrand {
  id: string;
  name: string;
  icon_url: string | null;
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
  { value: 'credito', label: 'Cartão de Crédito' },
  { value: 'debito', label: 'Cartão de Débito' },
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'dinheiro', label: 'Dinheiro' },
];
