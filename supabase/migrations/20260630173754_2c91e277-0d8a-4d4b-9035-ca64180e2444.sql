
-- 1. Rastreabilidade em financial_entries
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS data_original text,
  ADD COLUMN IF NOT EXISTS delay_rule_applied jsonb,
  ADD COLUMN IF NOT EXISTS payment_method_key text;

CREATE INDEX IF NOT EXISTS idx_fe_payment_method_key ON public.financial_entries(payment_method_key);
CREATE INDEX IF NOT EXISTS idx_fe_data_original ON public.financial_entries(data_original);

-- 2. import_audits
CREATE TABLE IF NOT EXISTS public.import_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  upload_id uuid REFERENCES public.upload_records(id) ON DELETE SET NULL,
  created_by uuid,
  file_name text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_audits TO authenticated;
GRANT ALL ON public.import_audits TO service_role;

ALTER TABLE public.import_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_select" ON public.import_audits FOR SELECT
  USING (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY "ia_insert" ON public.import_audits FOR INSERT
  WITH CHECK (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY "ia_update" ON public.import_audits FOR UPDATE
  USING (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY "ia_delete" ON public.import_audits FOR DELETE
  USING (is_admin() OR user_has_school_access(auth.uid(), school_id));

CREATE INDEX IF NOT EXISTS idx_import_audits_school ON public.import_audits(school_id);
CREATE INDEX IF NOT EXISTS idx_import_audits_upload ON public.import_audits(upload_id);

CREATE TRIGGER trg_import_audits_updated_at
  BEFORE UPDATE ON public.import_audits
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
