CREATE TABLE public.client_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text,
  cargo text,
  vr_diario numeric NOT NULL DEFAULT 0,
  vt_diario numeric NOT NULL DEFAULT 0,
  recebe_vt boolean NOT NULL DEFAULT true,
  pix_tipo text,
  pix_chave text,
  desligado_em date,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.client_employees(school_id);

CREATE TABLE public.client_payroll_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month text NOT NULL,
  source_file text NOT NULL,
  source_kind text NOT NULL,
  storage_path text,
  total_liquido numeric NOT NULL DEFAULT 0,
  qtd integer NOT NULL DEFAULT 0,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid
);
CREATE INDEX ON public.client_payroll_uploads(school_id, month);

CREATE TABLE public.client_payroll_month (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month text NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.client_employees(id) ON DELETE CASCADE,
  dias_trabalhados numeric,
  liquido numeric,
  liquido_origem_upload_id uuid REFERENCES public.client_payroll_uploads(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, month, employee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_employees, public.client_payroll_uploads, public.client_payroll_month TO authenticated;
GRANT ALL ON public.client_employees, public.client_payroll_uploads, public.client_payroll_month TO service_role;

ALTER TABLE public.client_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payroll_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payroll_month ENABLE ROW LEVEL SECURITY;

CREATE POLICY cp_emp_team ON public.client_employees FOR ALL TO authenticated USING (is_admin() AND user_has_school_access(auth.uid(), school_id)) WITH CHECK (is_admin() AND user_has_school_access(auth.uid(), school_id));
CREATE POLICY cp_emp_restricted ON public.client_employees AS RESTRICTIVE FOR ALL TO authenticated USING (can_see_school(school_id)) WITH CHECK (can_see_school(school_id));
CREATE POLICY cp_up_team ON public.client_payroll_uploads FOR ALL TO authenticated USING (is_admin() AND user_has_school_access(auth.uid(), school_id)) WITH CHECK (is_admin() AND user_has_school_access(auth.uid(), school_id));
CREATE POLICY cp_up_restricted ON public.client_payroll_uploads AS RESTRICTIVE FOR ALL TO authenticated USING (can_see_school(school_id)) WITH CHECK (can_see_school(school_id));
CREATE POLICY cp_mon_team ON public.client_payroll_month FOR ALL TO authenticated USING (is_admin() AND user_has_school_access(auth.uid(), school_id)) WITH CHECK (is_admin() AND user_has_school_access(auth.uid(), school_id));
CREATE POLICY cp_mon_restricted ON public.client_payroll_month AS RESTRICTIVE FOR ALL TO authenticated USING (can_see_school(school_id)) WITH CHECK (can_see_school(school_id));

-- Excluir um upload remove os líquidos que vieram dele.
CREATE OR REPLACE FUNCTION public.client_payroll_upload_cleanup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.client_payroll_month SET liquido = NULL, liquido_origem_upload_id = NULL, updated_at = now() WHERE liquido_origem_upload_id = OLD.id;
  RETURN OLD;
END $$;
CREATE TRIGGER client_payroll_upload_cleanup BEFORE DELETE ON public.client_payroll_uploads FOR EACH ROW EXECUTE FUNCTION public.client_payroll_upload_cleanup();

CREATE POLICY cp_files_team ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'client-payroll-files' AND is_admin() AND user_has_school_access(auth.uid(), ((storage.foldername(name))[1])::uuid) AND can_see_school(((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'client-payroll-files' AND is_admin() AND user_has_school_access(auth.uid(), ((storage.foldername(name))[1])::uuid) AND can_see_school(((storage.foldername(name))[1])::uuid));