-- Restringir escrita de tetos de gastos apenas a administradores
DROP POLICY IF EXISTS ec_insert ON public.expense_ceilings;
DROP POLICY IF EXISTS ec_update ON public.expense_ceilings;
DROP POLICY IF EXISTS ec_delete ON public.expense_ceilings;

CREATE POLICY ec_insert_admin ON public.expense_ceilings
  FOR INSERT TO public WITH CHECK (is_admin());

CREATE POLICY ec_update_admin ON public.expense_ceilings
  FOR UPDATE TO public USING (is_admin());

CREATE POLICY ec_delete_admin ON public.expense_ceilings
  FOR DELETE TO public USING (is_admin());