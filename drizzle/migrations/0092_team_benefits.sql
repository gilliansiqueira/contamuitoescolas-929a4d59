ALTER TABLE public.team_payroll_defaults ADD COLUMN IF NOT EXISTS vr_diario numeric, ADD COLUMN IF NOT EXISTS vt_cartao boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS recebe_vt boolean NOT NULL DEFAULT true;
CREATE TABLE public.team_benefit_month (
  month text PRIMARY KEY,
  dias_uteis integer,
  vt_diario numeric NOT NULL DEFAULT 12,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_benefit_month TO authenticated;
GRANT ALL ON public.team_benefit_month TO service_role;
ALTER TABLE public.team_benefit_month ENABLE ROW LEVEL SECURITY;
CREATE POLICY "benefit month read" ON public.team_benefit_month FOR SELECT TO authenticated USING (public.can_view_team_time());
CREATE POLICY "benefit month write" ON public.team_benefit_month FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());