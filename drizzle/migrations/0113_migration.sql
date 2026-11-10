CREATE OR REPLACE FUNCTION public.can_oversee_team()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_super_admin() OR (public.is_admin() AND EXISTS (
    SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid() AND permission = 'team_oversight'))
$$;
GRANT EXECUTE ON FUNCTION public.can_oversee_team() TO authenticated;

DO $do$
DECLARE f text; d text;
BEGIN
  FOREACH f IN ARRAY ARRAY['get_management_daily_status','get_management_portfolio','get_management_reconciliation_backlog'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=f;
    d := replace(d, 'v_all := public.is_super_admin() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.admin_scope = ''all'');', 'v_all := public.can_oversee_team();');
    d := replace(d, '(v_all OR sms.responsible_user_id = auth.uid() OR public.user_has_school_access(auth.uid(), s.id))',
      '(v_all OR sms.responsible_user_id = auth.uid() OR (NOT EXISTS (SELECT 1 FROM public.profiles pz WHERE pz.user_id = auth.uid() AND pz.admin_scope = ''all'') AND public.user_has_school_access(auth.uid(), s.id)))');
    IF position('can_oversee_team' in d) = 0 THEN RAISE EXCEPTION 'replace falhou em %', f; END IF;
    EXECUTE d;
  END LOOP;
END $do$;

INSERT INTO public.user_permissions (user_id, permission)
SELECT p.user_id, 'team_oversight' FROM public.profiles p
WHERE p.email IN ('gisele@contamuito.com.br','isabelly@contamuito.com.br','anacarolina@contamuito.com')
ON CONFLICT DO NOTHING;