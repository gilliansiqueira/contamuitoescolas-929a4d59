CREATE TABLE IF NOT EXISTS public.ensure_runs (
  kind text NOT NULL, school_id uuid NOT NULL, ref text NOT NULL, ran_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, school_id, ref)
);
GRANT ALL ON public.ensure_runs TO service_role;
ALTER TABLE public.ensure_runs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ensure_monthly_checklist_bulk(_school_ids uuid[], _month text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s uuid; n int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito à equipe autorizada.'; END IF;
  IF _month !~ '^[0-9]{4}-[0-9]{2}$' THEN RAISE EXCEPTION 'Período inválido.'; END IF;
  FOREACH s IN ARRAY coalesce(_school_ids, '{}') LOOP
    CONTINUE WHEN NOT public.can_see_school(s);
    CONTINUE WHEN auth.uid() IS NOT NULL AND NOT public.user_has_school_access(auth.uid(), s);
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.ensure_runs r WHERE r.kind='monthly' AND r.school_id=s AND r.ref=_month AND r.ran_at > now() - interval '5 minutes');
    n := n + public._refresh_report_progress(s, _month);
    INSERT INTO public.ensure_runs(kind, school_id, ref) VALUES ('monthly', s, _month)
      ON CONFLICT (kind, school_id, ref) DO UPDATE SET ran_at = now();
  END LOOP;
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.ensure_daily_tasks_bulk(_school_ids uuid[], _day date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s uuid; n int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito à equipe autorizada.'; END IF;
  FOREACH s IN ARRAY coalesce(_school_ids, '{}') LOOP
    CONTINUE WHEN NOT public.can_see_school(s);
    CONTINUE WHEN auth.uid() IS NOT NULL AND NOT public.user_has_school_access(auth.uid(), s);
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.ensure_runs r WHERE r.kind='daily' AND r.school_id=s AND r.ref=_day::text AND r.ran_at > now() - interval '2 minutes');
    n := n + public.ensure_daily_tasks(s, _day);
    INSERT INTO public.ensure_runs(kind, school_id, ref) VALUES ('daily', s, _day::text)
      ON CONFLICT (kind, school_id, ref) DO UPDATE SET ran_at = now();
  END LOOP;
  RETURN n;
END; $$;

GRANT EXECUTE ON FUNCTION public.ensure_monthly_checklist_bulk(uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_daily_tasks_bulk(uuid[], date) TO authenticated;