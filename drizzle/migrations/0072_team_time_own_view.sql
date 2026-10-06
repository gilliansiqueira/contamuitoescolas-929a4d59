ALTER TABLE public.team_time_employees ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.my_team_time_external_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT external_id FROM public.team_time_employees WHERE user_id = auth.uid() AND auth.uid() IS NOT NULL LIMIT 1
$$;

CREATE POLICY "Funcionária lê o próprio cadastro" ON public.team_time_employees FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Funcionária lê o próprio ponto" ON public.team_time_daily FOR SELECT TO authenticated USING (employee_external_id = public.my_team_time_external_id());
CREATE POLICY "Funcionária lê as próprias ocorrências" ON public.team_time_occurrences FOR SELECT TO authenticated USING (employee_external_id = public.my_team_time_external_id());
CREATE POLICY "Funcionária lê o próprio banco" ON public.team_time_hour_bank FOR SELECT TO authenticated USING (employee_external_id = public.my_team_time_external_id());

CREATE TABLE public.team_time_justifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_external_id text NOT NULL,
  dia date NOT NULL,
  motivo text NOT NULL CHECK (char_length(motivo) BETWEEN 3 AND 500),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aceita','recusada')),
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  revisado_por uuid,
  revisado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_external_id, dia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_time_justifications TO authenticated;
GRANT ALL ON public.team_time_justifications TO service_role;
ALTER TABLE public.team_time_justifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura justificativas" ON public.team_time_justifications FOR SELECT TO authenticated
  USING (public.can_view_team_time() OR employee_external_id = public.my_team_time_external_id());
CREATE POLICY "Funcionária cria justificativa" ON public.team_time_justifications FOR INSERT TO authenticated
  WITH CHECK (employee_external_id = public.my_team_time_external_id() AND criado_por = auth.uid() AND status = 'pendente');
CREATE POLICY "Funcionária edita pendente" ON public.team_time_justifications FOR UPDATE TO authenticated
  USING (employee_external_id = public.my_team_time_external_id() AND status = 'pendente')
  WITH CHECK (employee_external_id = public.my_team_time_external_id() AND status = 'pendente' AND revisado_por IS NULL);
CREATE POLICY "Super admin revisa" ON public.team_time_justifications FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin apaga" ON public.team_time_justifications FOR DELETE TO authenticated USING (public.is_super_admin());

CREATE TRIGGER team_time_justifications_touch BEFORE UPDATE ON public.team_time_justifications FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();