CREATE TABLE public.card_sheet_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('recebimento','venda')),
  adquirente text NOT NULL,
  source_file text NOT NULL,
  file_hash text NOT NULL,
  period_from date, period_to date,
  rows_count int NOT NULL DEFAULT 0,
  total_bruto numeric NOT NULL DEFAULT 0,
  total_liquido numeric NOT NULL DEFAULT 0,
  column_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, kind, file_hash)
);
CREATE TABLE public.card_sheet_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  origem_upload_id uuid NOT NULL REFERENCES public.card_sheet_imports(id) ON DELETE CASCADE,
  source_kind text NOT NULL,
  source_file text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  adquirente text NOT NULL,
  data_venda date, data_pagamento date,
  bruto numeric, taxa numeric, liquido numeric,
  bandeira text, forma text, parcela text, nsu text,
  row_key text NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX card_sheet_rows_dedupe ON public.card_sheet_rows (school_id, source_kind, adquirente, row_key);
CREATE INDEX card_sheet_rows_upload ON public.card_sheet_rows (origem_upload_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_sheet_imports, public.card_sheet_rows TO authenticated;
GRANT ALL ON public.card_sheet_imports, public.card_sheet_rows TO service_role;
ALTER TABLE public.card_sheet_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_sheet_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe card imports" ON public.card_sheet_imports FOR ALL TO authenticated
  USING (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id))
  WITH CHECK (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "restrita card imports" ON public.card_sheet_imports AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));
CREATE POLICY "equipe card rows" ON public.card_sheet_rows FOR ALL TO authenticated
  USING (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id))
  WITH CHECK (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "restrita card rows" ON public.card_sheet_rows AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));