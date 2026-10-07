CREATE TABLE public.renewal_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  purpose text NOT NULL DEFAULT '',
  sponte_path text,
  filters text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  validated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.renewal_sources TO authenticated;
GRANT ALL ON public.renewal_sources TO service_role;
ALTER TABLE public.renewal_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY renewal_sources_admin ON public.renewal_sources FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.renewal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  version integer NOT NULL,
  name text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  structure jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_file text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, version)
);
CREATE TABLE public.renewal_settings (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  include_material boolean NOT NULL DEFAULT false,
  module_categories text[] NOT NULL DEFAULT ARRAY['Parcela Regular','Parcela Especial'],
  separate_modalities text[] NOT NULL DEFAULT ARRAY['Personal','VIP','Semi','ON'],
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.renewal_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  period text NOT NULL,
  template_id uuid REFERENCES public.renewal_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aguardando_relatorios',
  responsible_user_id uuid,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_version integer NOT NULL DEFAULT 0,
  sent_version integer,
  dirty boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, period)
);
CREATE TABLE public.renewal_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.renewal_sheets(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  file_name text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.renewal_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.renewal_sheets(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  row_key text NOT NULL,
  imported jsonb NOT NULL DEFAULT '{}'::jsonb,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  conflicts jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  manual boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sheet_id, row_key)
);
CREATE TABLE public.renewal_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.renewal_sheets(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  kind text NOT NULL,
  row_key text,
  message text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.renewal_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.renewal_sheets(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  version integer NOT NULL,
  file_path text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sheet_id, version)
);
CREATE TABLE public.renewal_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.renewal_sheets(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  version integer NOT NULL,
  sent_at date NOT NULL,
  recipient text NOT NULL,
  channel text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.renewal_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.renewal_sheets(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'aberto',
  resolution text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['renewal_templates','renewal_settings','renewal_sheets','renewal_imports','renewal_rows','renewal_issues','renewal_versions','renewal_deliveries','renewal_change_requests'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t || '_team', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id))', t || '_restricted', t);
  END LOOP;
END $$;

CREATE INDEX ON public.renewal_rows (sheet_id);
CREATE INDEX ON public.renewal_issues (sheet_id);

CREATE POLICY renewal_files_team_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'renewal-files' AND public.is_admin());
CREATE POLICY renewal_files_team_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'renewal-files' AND public.is_admin());