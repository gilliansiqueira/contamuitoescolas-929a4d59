CREATE TABLE public.product_sales_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month text NOT NULL,
  produto text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  quantidade numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, month, produto)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_sales_monthly TO authenticated;
GRANT ALL ON public.product_sales_monthly TO service_role;

ALTER TABLE public.product_sales_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_sales_read ON public.product_sales_monthly
  FOR SELECT TO authenticated
  USING (public.user_has_school_access(auth.uid(), school_id));

CREATE POLICY product_sales_write ON public.product_sales_monthly
  FOR ALL TO authenticated
  USING (public.user_has_school_access(auth.uid(), school_id))
  WITH CHECK (public.user_has_school_access(auth.uid(), school_id));

CREATE POLICY product_sales_restricted ON public.product_sales_monthly
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(school_id))
  WITH CHECK (public.can_see_school(school_id));

CREATE INDEX product_sales_monthly_school_month_idx ON public.product_sales_monthly (school_id, month);