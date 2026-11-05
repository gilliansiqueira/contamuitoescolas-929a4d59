ALTER TABLE public.kpi_definitions ADD COLUMN IF NOT EXISTS auto_key text;

CREATE TABLE public.monthly_integral_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  valor numeric NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_integral_revenue TO authenticated;
GRANT ALL ON public.monthly_integral_revenue TO service_role;
ALTER TABLE public.monthly_integral_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY mir_restrita ON public.monthly_integral_revenue AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));
CREATE POLICY mir_select ON public.monthly_integral_revenue FOR SELECT TO authenticated
  USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY mir_write ON public.monthly_integral_revenue FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.guard_integral_revenue_closed_month()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_month_closed(COALESCE(NEW.school_id, OLD.school_id), COALESCE(NEW.month, OLD.month)) THEN
    RAISE EXCEPTION 'Mês fechado: reabra o fechamento para alterar a receita integral';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_integral_revenue BEFORE INSERT OR UPDATE OR DELETE ON public.monthly_integral_revenue
  FOR EACH ROW EXECUTE FUNCTION public.guard_integral_revenue_closed_month();