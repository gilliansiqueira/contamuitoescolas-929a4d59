CREATE OR REPLACE FUNCTION public._access_can(_school uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.admin_manages_school(_school) AND public.can_see_school(_school) $$;
DROP POLICY "equipe le acessos" ON public.client_access_entries;
CREATE POLICY "equipe le acessos" ON public.client_access_entries FOR SELECT TO authenticated USING (public._access_can(school_id));
DROP POLICY "equipe le historico acessos" ON public.client_access_history;
CREATE POLICY "equipe le historico acessos" ON public.client_access_history FOR SELECT TO authenticated USING (public._access_can(school_id));
DROP POLICY "equipe le views" ON public.client_access_views;
CREATE POLICY "equipe le views" ON public.client_access_views FOR SELECT TO authenticated USING (public._access_can(school_id));