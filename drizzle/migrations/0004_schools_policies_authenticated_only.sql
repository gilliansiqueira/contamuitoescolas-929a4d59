-- As políticas de administrador eram avaliadas também para visitantes (role PUBLIC),
-- causando "permission denied for function is_admin" no modo demonstração.
DROP POLICY IF EXISTS "View own school or admin" ON public.schools;
DROP POLICY IF EXISTS "Admin manage schools insert" ON public.schools;
DROP POLICY IF EXISTS "Admin manage schools update" ON public.schools;
DROP POLICY IF EXISTS "Admin manage schools delete" ON public.schools;

CREATE POLICY "View own school or admin"
ON public.schools FOR SELECT TO authenticated
USING (is_admin() OR user_has_school_access(auth.uid(), id));

CREATE POLICY "Admin manage schools insert"
ON public.schools FOR INSERT TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Admin manage schools update"
ON public.schools FOR UPDATE TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin manage schools delete"
ON public.schools FOR DELETE TO authenticated
USING (is_admin());