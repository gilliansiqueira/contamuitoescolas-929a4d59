CREATE OR REPLACE FUNCTION public.can_view_client_logins() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR (public.is_admin() AND EXISTS (
    SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid() AND permission = 'client_logins_view'))
$$;

CREATE TABLE public.client_access_log (
  user_id uuid NOT NULL,
  day date NOT NULL,
  first_at timestamptz NOT NULL DEFAULT now(),
  last_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT ON public.client_access_log TO authenticated;
GRANT ALL ON public.client_access_log TO service_role;
ALTER TABLE public.client_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewers read client access log" ON public.client_access_log FOR SELECT TO authenticated USING (public.can_view_client_logins());

CREATE OR REPLACE FUNCTION public.touch_client_access() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_client_user(auth.uid()) THEN RETURN; END IF;
  INSERT INTO public.client_access_log(user_id, day) VALUES (auth.uid(), (now() AT TIME ZONE 'America/Sao_Paulo')::date)
  ON CONFLICT (user_id, day) DO UPDATE SET last_at = now();
END $$;
GRANT EXECUTE ON FUNCTION public.touch_client_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_client_access_overview()
RETURNS TABLE(user_id uuid, email text, school_id uuid, school_name text, last_sign_in_at timestamptz, last_seen_at timestamptz, days_30 integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_view_client_logins() THEN RAISE EXCEPTION 'sem permissão'; END IF;
  RETURN QUERY
  WITH cl AS (
    SELECT DISTINCT r.user_id FROM public.user_roles r WHERE r.role = 'cliente'
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r2 WHERE r2.user_id = r.user_id AND r2.role IN ('admin','super_admin'))
  ), links AS (
    SELECT p.user_id, p.school_id FROM public.profiles p JOIN cl ON cl.user_id = p.user_id WHERE p.school_id IS NOT NULL
    UNION SELECT us.user_id, us.school_id FROM public.user_schools us JOIN cl ON cl.user_id = us.user_id
  )
  SELECT u.id, u.email::text, s.id, s.nome::text, u.last_sign_in_at,
    (SELECT max(l.last_at) FROM public.client_access_log l WHERE l.user_id = u.id),
    (SELECT count(*)::int FROM public.client_access_log l WHERE l.user_id = u.id AND l.day >= current_date - 30)
  FROM cl JOIN auth.users u ON u.id = cl.user_id
  LEFT JOIN links k ON k.user_id = u.id
  LEFT JOIN public.schools s ON s.id = k.school_id
  WHERE s.id IS NULL OR public.can_see_school(s.id);
END $$;
GRANT EXECUTE ON FUNCTION public.get_client_access_overview() TO authenticated;