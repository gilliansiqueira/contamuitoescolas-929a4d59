
CREATE TABLE public.investment_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL,
  month text NOT NULL,
  aplicacao numeric NOT NULL DEFAULT 0,
  resgate numeric NOT NULL DEFAULT 0,
  rendimentos numeric NOT NULL DEFAULT 0,
  encargos numeric NOT NULL DEFAULT 0,
  rendimento_provisionado numeric NOT NULL DEFAULT 0,
  saldo_inicial numeric NOT NULL DEFAULT 0,
  saldo_final numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, month)
);

ALTER TABLE public.investment_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY ie_select ON public.investment_entries FOR SELECT
  USING (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY ie_insert ON public.investment_entries FOR INSERT
  WITH CHECK (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY ie_update ON public.investment_entries FOR UPDATE
  USING (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY ie_delete ON public.investment_entries FOR DELETE
  USING (is_admin() OR user_has_school_access(auth.uid(), school_id));
