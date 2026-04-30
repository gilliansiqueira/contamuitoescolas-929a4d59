CREATE TABLE public.expense_ceilings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  category_name text NOT NULL,
  semester text NOT NULL,
  ceiling numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (school_id, category_name, semester)
);

ALTER TABLE public.expense_ceilings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ec_select ON public.expense_ceilings FOR SELECT USING (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY ec_insert ON public.expense_ceilings FOR INSERT WITH CHECK (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY ec_update ON public.expense_ceilings FOR UPDATE USING (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY ec_delete ON public.expense_ceilings FOR DELETE USING (is_admin() OR user_has_school_access(auth.uid(), school_id));

CREATE OR REPLACE FUNCTION public.tg_expense_ceilings_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_expense_ceilings_updated_at
  BEFORE UPDATE ON public.expense_ceilings
  FOR EACH ROW EXECUTE FUNCTION public.tg_expense_ceilings_set_updated_at();