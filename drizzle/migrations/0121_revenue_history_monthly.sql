CREATE TABLE public.revenue_history_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  value numeric NOT NULL,
  source_kind text NOT NULL DEFAULT 'manual',
  source_file text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (school_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_history_monthly TO authenticated;
GRANT ALL ON public.revenue_history_monthly TO service_role;
ALTER TABLE public.revenue_history_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rhm read" ON public.revenue_history_monthly FOR SELECT TO authenticated
  USING (public.user_has_school_access(auth.uid(), school_id) OR public.is_admin());
CREATE POLICY "rhm team write" ON public.revenue_history_monthly FOR ALL TO authenticated
  USING (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id))
  WITH CHECK (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "rhm restricted" ON public.revenue_history_monthly AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));