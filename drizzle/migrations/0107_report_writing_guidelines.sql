CREATE TABLE public.report_writing_guidelines (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_writing_guidelines TO authenticated;
GRANT ALL ON public.report_writing_guidelines TO service_role;
ALTER TABLE public.report_writing_guidelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manages guidelines" ON public.report_writing_guidelines FOR ALL TO authenticated
  USING (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id))
  WITH CHECK (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "restricted schools" ON public.report_writing_guidelines AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));