ALTER TABLE public.team_time_employees ADD COLUMN IF NOT EXISTS desligado_em date;
GRANT UPDATE (desligado_em) ON public.team_time_employees TO authenticated;
CREATE POLICY "Super admin define desligamento" ON public.team_time_employees FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());