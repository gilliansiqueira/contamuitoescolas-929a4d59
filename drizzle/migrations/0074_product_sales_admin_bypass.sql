DROP POLICY IF EXISTS product_sales_read ON public.product_sales_monthly;
DROP POLICY IF EXISTS product_sales_write ON public.product_sales_monthly;

CREATE POLICY product_sales_read ON public.product_sales_monthly
  FOR SELECT TO authenticated
  USING (
    public.user_has_school_access(auth.uid(), school_id)
    OR public.is_admin()
  );

CREATE POLICY product_sales_write ON public.product_sales_monthly
  FOR ALL TO authenticated
  USING (
    public.user_has_school_access(auth.uid(), school_id)
    OR public.is_admin()
  )
  WITH CHECK (
    public.user_has_school_access(auth.uid(), school_id)
    OR public.is_admin()
  );