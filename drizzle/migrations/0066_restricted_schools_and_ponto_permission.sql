ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS restrita boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.can_see_school(_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _school_id IS NULL
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR auth.uid() IS NULL
    OR NOT COALESCE((SELECT s.restrita FROM public.schools s WHERE s.id = _school_id), false)
$$;

-- Restrictive policy on every table with school_id
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_schema=c.table_schema AND tb.table_name=c.table_name AND tb.table_type='BASE TABLE'
    WHERE c.table_schema='public' AND c.column_name='school_id'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Empresa restrita só super admin" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Empresa restrita só super admin" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id))', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Empresa restrita só super admin" ON public.schools;
CREATE POLICY "Empresa restrita só super admin" ON public.schools AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(id)) WITH CHECK (public.can_see_school(id));

-- Access function also blocks restricted schools
CREATE OR REPLACE FUNCTION public.user_has_school_access(_user_id uuid, _school_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND school_id = _school_id)
     OR EXISTS (SELECT 1 FROM public.user_schools WHERE user_id = _user_id AND school_id = _school_id))
    AND (
      COALESCE((SELECT s.ativo FROM public.schools s WHERE s.id = _school_id), true)
      OR public.has_role(_user_id, 'admin'::public.app_role)
      OR public.has_role(_user_id, 'super_admin'::public.app_role)
    )
    AND (
      NOT COALESCE((SELECT s.restrita FROM public.schools s WHERE s.id = _school_id), false)
      OR public.has_role(_user_id, 'super_admin'::public.app_role)
    );
$function$;

-- Management RPCs (security definer) skip restricted schools
DO $$
DECLARE f text; d text; nd text;
BEGIN
  FOREACH f IN ARRAY ARRAY['get_management_portfolio','get_management_daily_status','get_management_reconciliation_backlog','get_management_responsible_candidates'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=f;
    nd := regexp_replace(d, 'FROM public\.schools s(\s)', 'FROM (SELECT * FROM public.schools WHERE public.can_see_school(id)) s\1', 'g');
    IF nd = d THEN RAISE NOTICE 'no schools ref in %', f; ELSE EXECUTE nd; END IF;
  END LOOP;
END $$;

-- Per-user permissions (Ponto view)
CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id uuid NOT NULL,
  permission text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission)
);
GRANT SELECT ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver próprias permissões" ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

CREATE OR REPLACE FUNCTION public.can_view_team_time()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid() AND permission = 'ponto_view')
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['team_time_daily','team_time_employees','team_time_hour_bank','team_time_occurrences','team_time_settings','team_time_sync_errors','team_time_sync_runs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Somente super_admin lê" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Equipe autorizada lê" ON public.%I FOR SELECT TO authenticated USING (public.can_view_team_time())', t);
  END LOOP;
END $$;