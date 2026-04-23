-- Categorias de recebimento (cadastros por escola)
CREATE TABLE public.receivable_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.receivable_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY rc_select ON public.receivable_categories FOR SELECT
  USING (is_admin() OR school_id = current_user_school_id());
CREATE POLICY rc_insert ON public.receivable_categories FOR INSERT
  WITH CHECK (is_admin() OR school_id = current_user_school_id());
CREATE POLICY rc_update ON public.receivable_categories FOR UPDATE
  USING (is_admin() OR school_id = current_user_school_id());
CREATE POLICY rc_delete ON public.receivable_categories FOR DELETE
  USING (is_admin() OR school_id = current_user_school_id());

-- Valores mensais por categoria
CREATE TABLE public.receivable_category_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.receivable_categories(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- YYYY-MM
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (category_id, month)
);

CREATE INDEX idx_rcv_school_month ON public.receivable_category_values(school_id, month);

ALTER TABLE public.receivable_category_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY rcv_select ON public.receivable_category_values FOR SELECT
  USING (is_admin() OR school_id = current_user_school_id());
CREATE POLICY rcv_insert ON public.receivable_category_values FOR INSERT
  WITH CHECK (is_admin() OR school_id = current_user_school_id());
CREATE POLICY rcv_update ON public.receivable_category_values FOR UPDATE
  USING (is_admin() OR school_id = current_user_school_id());
CREATE POLICY rcv_delete ON public.receivable_category_values FOR DELETE
  USING (is_admin() OR school_id = current_user_school_id());

-- Adicionar entrada padrão de tab para a nova aba (não obrigatório, default já é true via fallback)