CREATE TABLE public.commercial_history_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  year int NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  metric text NOT NULL CHECK (metric IN ('contatos_receptivos','contatos_ativos','matriculas')),
  value numeric NOT NULL CHECK (value >= 0),
  source_kind text NOT NULL DEFAULT 'manual',
  source_file text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (school_id, year, month, metric)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_history_monthly TO authenticated;
GRANT ALL ON public.commercial_history_monthly TO service_role;
ALTER TABLE public.commercial_history_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chm read" ON public.commercial_history_monthly FOR SELECT TO authenticated
  USING (public.user_has_school_access(auth.uid(), school_id) OR public.is_admin());
CREATE POLICY "chm team write" ON public.commercial_history_monthly FOR ALL TO authenticated
  USING (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id))
  WITH CHECK (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "chm restricted" ON public.commercial_history_monthly AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));