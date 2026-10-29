CREATE TABLE public.team_alert_dismissals (
  user_id uuid NOT NULL,
  dia date NOT NULL,
  PRIMARY KEY (user_id, dia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_alert_dismissals TO authenticated;
GRANT ALL ON public.team_alert_dismissals TO service_role;
ALTER TABLE public.team_alert_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dismissals" ON public.team_alert_dismissals FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.client_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  responsavel_id uuid,
  prazo date,
  status text NOT NULL DEFAULT 'aberto',
  observacoes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_requests TO authenticated;
GRANT ALL ON public.client_requests TO service_role;
ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manages requests" ON public.client_requests FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "restricted schools" ON public.client_requests AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));
CREATE TRIGGER client_requests_touch BEFORE UPDATE ON public.client_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE OR REPLACE FUNCTION public.client_requests_validate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('aberto','aguardando','resolvido') THEN RAISE EXCEPTION 'status inválido'; END IF;
  IF NEW.status = 'resolvido' AND NEW.resolved_at IS NULL THEN NEW.resolved_at := now(); END IF;
  IF NEW.status <> 'resolvido' THEN NEW.resolved_at := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER client_requests_validate BEFORE INSERT OR UPDATE ON public.client_requests
  FOR EACH ROW EXECUTE FUNCTION public.client_requests_validate();

CREATE TABLE public.school_profile (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  contatos jsonb NOT NULL DEFAULT '[]'::jsonb,
  bancos text,
  sistemas text,
  dia_extrato text,
  observacoes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_profile TO authenticated;
GRANT ALL ON public.school_profile TO service_role;
ALTER TABLE public.school_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manages profile" ON public.school_profile FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "restricted schools" ON public.school_profile AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));
CREATE TRIGGER school_profile_touch BEFORE UPDATE ON public.school_profile
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();