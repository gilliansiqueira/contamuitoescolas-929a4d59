CREATE TABLE public.team_supervision (
  supervisor_id uuid NOT NULL,
  member_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supervisor_id, member_id),
  CHECK (supervisor_id <> member_id)
);
GRANT SELECT, INSERT, DELETE ON public.team_supervision TO authenticated;
GRANT ALL ON public.team_supervision TO service_role;
ALTER TABLE public.team_supervision ENABLE ROW LEVEL SECURITY;
CREATE POLICY ts_select ON public.team_supervision FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY ts_super_write ON public.team_supervision FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.user_has_school_access(_user_id uuid, _school_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND school_id = _school_id)
     OR EXISTS (SELECT 1 FROM public.user_schools WHERE user_id = _user_id AND school_id = _school_id)
     OR EXISTS (SELECT 1 FROM public.team_supervision ts JOIN public.user_schools us ON us.user_id = ts.member_id
                WHERE ts.supervisor_id = _user_id AND us.school_id = _school_id))
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

CREATE OR REPLACE FUNCTION public.admin_manages_school(_school_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR (public.is_admin() AND public.can_see_school(_school_id) AND (
    public.user_has_school_access(auth.uid(), _school_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND admin_scope = 'all')
  ))
$$;