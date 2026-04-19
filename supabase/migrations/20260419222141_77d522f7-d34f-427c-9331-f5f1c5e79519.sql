-- Tabela de histórico financeiro mensal consolidado
CREATE TABLE public.historical_monthly (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- formato YYYY-MM
  tipo_valor TEXT NOT NULL, -- chave do tipo (receita, despesa, investimento, bb_rende_facil, etc.)
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, month, tipo_valor)
);

CREATE INDEX idx_historical_monthly_school_month ON public.historical_monthly(school_id, month);

ALTER TABLE public.historical_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY hm_select ON public.historical_monthly
  FOR SELECT USING (is_admin() OR school_id = current_user_school_id());

CREATE POLICY hm_insert ON public.historical_monthly
  FOR INSERT WITH CHECK (is_admin() OR school_id = current_user_school_id());

CREATE POLICY hm_update ON public.historical_monthly
  FOR UPDATE USING (is_admin() OR school_id = current_user_school_id());

CREATE POLICY hm_delete ON public.historical_monthly
  FOR DELETE USING (is_admin() OR school_id = current_user_school_id());

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_historical_monthly_updated
  BEFORE UPDATE ON public.historical_monthly
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();