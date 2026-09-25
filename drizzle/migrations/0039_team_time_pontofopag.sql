-- Ponto da Equipe (PontoFopag) — área interna, somente super_admin. Tabelas isoladas, sem relação com dados financeiros.
CREATE TABLE public.team_time_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  matricula text,
  nome text NOT NULL,
  cargo text,
  departamento text,
  horario_previsto text,
  ativo boolean NOT NULL DEFAULT true,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.team_time_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_external_id text NOT NULL REFERENCES public.team_time_employees(external_id) ON DELETE CASCADE,
  dia date NOT NULL,
  horario_previsto text,
  primeira_marcacao text,
  ultima_marcacao text,
  marcacoes text[] NOT NULL DEFAULT '{}',
  horas_trabalhadas text,
  horas_extras text,
  situacao text NOT NULL DEFAULT 'aguardando',
  ocorrencia text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_external_id, dia),
  CONSTRAINT team_time_daily_situacao_chk CHECK (situacao IN ('regular','atraso','sem_marcacao','incompleta','falta','hora_extra','inconsistencia','aguardando'))
);

CREATE TABLE public.team_time_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  employee_external_id text NOT NULL REFERENCES public.team_time_employees(external_id) ON DELETE CASCADE,
  dia date NOT NULL,
  tipo text NOT NULL,
  descricao text,
  origem text NOT NULL DEFAULT 'ocorrencias',
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX team_time_occurrences_dia_idx ON public.team_time_occurrences (dia);

CREATE TABLE public.team_time_hour_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_external_id text NOT NULL REFERENCES public.team_time_employees(external_id) ON DELETE CASCADE,
  competencia text NOT NULL,
  saldo text,
  saldo_minutos integer,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_external_id, competencia)
);

CREATE TABLE public.team_time_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  requested_by uuid,
  reference_date date,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text,
  CONSTRAINT team_time_sync_runs_status_chk CHECK (status IN ('running','success','error','not_configured'))
);

CREATE TABLE public.team_time_sync_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.team_time_sync_runs(id) ON DELETE CASCADE,
  endpoint text,
  http_status integer,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.team_time_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  auto_sync_enabled boolean NOT NULL DEFAULT false,
  sync_interval_minutes integer NOT NULL DEFAULT 15,
  work_start time NOT NULL DEFAULT '07:00',
  work_end time NOT NULL DEFAULT '19:00',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.team_time_settings (id) VALUES (true);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['team_time_employees','team_time_daily','team_time_occurrences','team_time_hour_bank','team_time_sync_runs','team_time_sync_errors','team_time_settings'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Somente super_admin lê" ON public.%I FOR SELECT TO authenticated USING (public.is_super_admin())', t);
  END LOOP;
END $$;
-- Sem políticas de escrita: só a função server-side (service_role) grava.