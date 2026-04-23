-- Tabela de ícones para Análise de Vendas (com suporte a galeria global)
CREATE TABLE IF NOT EXISTS public.sa_icons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_url text NOT NULL,
  is_global boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sa_icons ENABLE ROW LEVEL SECURITY;

CREATE POLICY sai_select ON public.sa_icons FOR SELECT
  USING (is_admin() OR is_global = true OR school_id = current_user_school_id());

CREATE POLICY sai_insert ON public.sa_icons FOR INSERT
  WITH CHECK (
    (is_global = true AND is_admin())
    OR (is_global = false AND (is_admin() OR school_id = current_user_school_id()))
  );

CREATE POLICY sai_update ON public.sa_icons FOR UPDATE
  USING (
    (is_global = true AND is_admin())
    OR (is_global = false AND (is_admin() OR school_id = current_user_school_id()))
  );

CREATE POLICY sai_delete ON public.sa_icons FOR DELETE
  USING (
    (is_global = true AND is_admin())
    OR (is_global = false AND (is_admin() OR school_id = current_user_school_id()))
  );

-- Vincular ícone a um produto
ALTER TABLE public.sales_analysis_products
  ADD COLUMN IF NOT EXISTS icon_url text;