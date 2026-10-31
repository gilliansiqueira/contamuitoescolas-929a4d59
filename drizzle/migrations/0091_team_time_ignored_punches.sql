CREATE TABLE public.team_time_daily_overrides (
  employee_external_id text NOT NULL REFERENCES public.team_time_employees(external_id) ON DELETE CASCADE,
  dia date NOT NULL,
  batidas_ignoradas text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_external_id, dia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_time_daily_overrides TO authenticated;
GRANT ALL ON public.team_time_daily_overrides TO service_role;
ALTER TABLE public.team_time_daily_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autorizada lê" ON public.team_time_daily_overrides FOR SELECT TO authenticated USING (public.can_view_team_time() OR employee_external_id = public.my_team_time_external_id());
CREATE POLICY "Super admin grava" ON public.team_time_daily_overrides FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
INSERT INTO public.team_time_daily_overrides (employee_external_id, dia, batidas_ignoradas) VALUES ('pf-20','2026-10-21',ARRAY['09:13']);