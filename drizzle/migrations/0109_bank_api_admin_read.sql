DROP POLICY IF EXISTS "Equipe vê conexões bancárias" ON public.bank_api_connections;
CREATE POLICY "Equipe vê conexões bancárias" ON public.bank_api_connections FOR SELECT TO authenticated USING (public.is_super_admin() OR (public.is_admin() AND public.admin_manages_school(school_id)));
DROP POLICY IF EXISTS "Equipe vê histórico de sincronização" ON public.bank_api_sync_runs;
CREATE POLICY "Equipe vê histórico de sincronização" ON public.bank_api_sync_runs FOR SELECT TO authenticated USING (public.is_super_admin() OR (public.is_admin() AND public.admin_manages_school(school_id)));