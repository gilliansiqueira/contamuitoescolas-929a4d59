-- =========================================
-- ANÁLISE DE VENDAS — Tabelas independentes
-- =========================================

-- Catálogo de produtos
CREATE TABLE public.sales_analysis_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_cost numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sap_school ON public.sales_analysis_products(school_id);
ALTER TABLE public.sales_analysis_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY sap_select ON public.sales_analysis_products FOR SELECT
USING (is_admin() OR school_id = current_user_school_id());
CREATE POLICY sap_insert ON public.sales_analysis_products FOR INSERT
WITH CHECK (is_admin() OR school_id = current_user_school_id());
CREATE POLICY sap_update ON public.sales_analysis_products FOR UPDATE
USING (is_admin() OR school_id = current_user_school_id());
CREATE POLICY sap_delete ON public.sales_analysis_products FOR DELETE
USING (is_admin() OR school_id = current_user_school_id());

-- Canais de venda
CREATE TABLE public.sales_analysis_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sac_school ON public.sales_analysis_channels(school_id);
ALTER TABLE public.sales_analysis_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY sac_select ON public.sales_analysis_channels FOR SELECT
USING (is_admin() OR school_id = current_user_school_id());
CREATE POLICY sac_insert ON public.sales_analysis_channels FOR INSERT
WITH CHECK (is_admin() OR school_id = current_user_school_id());
CREATE POLICY sac_update ON public.sales_analysis_channels FOR UPDATE
USING (is_admin() OR school_id = current_user_school_id());
CREATE POLICY sac_delete ON public.sales_analysis_channels FOR DELETE
USING (is_admin() OR school_id = current_user_school_id());

-- Formas de pagamento próprias deste módulo
CREATE TABLE public.sales_analysis_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sapm_school ON public.sales_analysis_payment_methods(school_id);
ALTER TABLE public.sales_analysis_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY sapm_select ON public.sales_analysis_payment_methods FOR SELECT
USING (is_admin() OR school_id = current_user_school_id());
CREATE POLICY sapm_insert ON public.sales_analysis_payment_methods FOR INSERT
WITH CHECK (is_admin() OR school_id = current_user_school_id());
CREATE POLICY sapm_update ON public.sales_analysis_payment_methods FOR UPDATE
USING (is_admin() OR school_id = current_user_school_id());
CREATE POLICY sapm_delete ON public.sales_analysis_payment_methods FOR DELETE
USING (is_admin() OR school_id = current_user_school_id());

-- Pedidos
CREATE TABLE public.sales_analysis_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  order_date text NOT NULL, -- YYYY-MM-DD (mesmo padrão do projeto)
  customer_name text NOT NULL DEFAULT '',
  channel_id uuid REFERENCES public.sales_analysis_channels(id) ON DELETE SET NULL,
  payment_method_id uuid REFERENCES public.sales_analysis_payment_methods(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'concluido', -- concluido | cancelado | pendente
  gross_value numeric NOT NULL DEFAULT 0,   -- faturamento bruto (soma itens)
  cost_total numeric NOT NULL DEFAULT 0,    -- custo total (soma itens)
  fees numeric NOT NULL DEFAULT 0,          -- taxas (cartão, etc.)
  shipping numeric NOT NULL DEFAULT 0,      -- frete pago pela escola
  shipping_paid_by_customer boolean NOT NULL DEFAULT true,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sao_school_date ON public.sales_analysis_orders(school_id, order_date);
ALTER TABLE public.sales_analysis_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY sao_select ON public.sales_analysis_orders FOR SELECT
USING (is_admin() OR school_id = current_user_school_id());
CREATE POLICY sao_insert ON public.sales_analysis_orders FOR INSERT
WITH CHECK (is_admin() OR school_id = current_user_school_id());
CREATE POLICY sao_update ON public.sales_analysis_orders FOR UPDATE
USING (is_admin() OR school_id = current_user_school_id());
CREATE POLICY sao_delete ON public.sales_analysis_orders FOR DELETE
USING (is_admin() OR school_id = current_user_school_id());

-- Itens de pedido
CREATE TABLE public.sales_analysis_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.sales_analysis_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.sales_analysis_products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '', -- snapshot caso o produto seja apagado
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_saoi_order ON public.sales_analysis_order_items(order_id);
ALTER TABLE public.sales_analysis_order_items ENABLE ROW LEVEL SECURITY;

-- Itens herdam acesso pelo pedido
CREATE POLICY saoi_select ON public.sales_analysis_order_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.sales_analysis_orders o
  WHERE o.id = order_id AND (is_admin() OR o.school_id = current_user_school_id())
));
CREATE POLICY saoi_insert ON public.sales_analysis_order_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sales_analysis_orders o
  WHERE o.id = order_id AND (is_admin() OR o.school_id = current_user_school_id())
));
CREATE POLICY saoi_update ON public.sales_analysis_order_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.sales_analysis_orders o
  WHERE o.id = order_id AND (is_admin() OR o.school_id = current_user_school_id())
));
CREATE POLICY saoi_delete ON public.sales_analysis_order_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.sales_analysis_orders o
  WHERE o.id = order_id AND (is_admin() OR o.school_id = current_user_school_id())
));