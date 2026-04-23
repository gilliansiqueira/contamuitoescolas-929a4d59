export interface SAProduct {
  id: string;
  school_id: string;
  name: string;
  default_cost: number;
  icon_url: string | null;
  active: boolean;
  sort_order: number;
}

export interface SAIcon {
  id: string;
  school_id: string | null;
  name: string;
  file_url: string;
  is_global: boolean;
}

export interface SAChannel {
  id: string;
  school_id: string;
  name: string;
  active: boolean;
  sort_order: number;
}

export interface SAPaymentMethod {
  id: string;
  school_id: string;
  name: string;
  active: boolean;
  sort_order: number;
}

export type SAOrderStatus = 'concluido' | 'cancelado' | 'pendente';

export interface SAOrder {
  id: string;
  school_id: string;
  order_date: string; // YYYY-MM-DD
  customer_name: string;
  channel_id: string | null;
  payment_method_id: string | null;
  status: SAOrderStatus;
  gross_value: number;
  cost_total: number;
  fees: number;
  shipping: number;
  shipping_paid_by_customer: boolean;
  notes: string;
}

export interface SAOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
}

export interface SAOrderWithItems extends SAOrder {
  items: SAOrderItem[];
}

export const STATUS_LABELS: Record<SAOrderStatus, string> = {
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  pendente: 'Pendente',
};

/** Card visibility config kept in localStorage per school */
export interface SACardVisibility {
  faturamento_bruto: boolean;
  faturamento_liquido: boolean;
  qtd_pedidos: boolean;
  ticket_medio: boolean;
  produto_mais_vendido: boolean;
  produto_mais_lucrativo: boolean;
  margem_bruta: boolean;
  lucro_bruto: boolean;
  forma_mais_usada: boolean;
  canal_top: boolean;
}

export const DEFAULT_CARD_VISIBILITY: SACardVisibility = {
  faturamento_bruto: true,
  faturamento_liquido: true,
  qtd_pedidos: true,
  ticket_medio: true,
  produto_mais_vendido: true,
  produto_mais_lucrativo: true,
  margem_bruta: true,
  lucro_bruto: true,
  forma_mais_usada: true,
  canal_top: true,
};
