GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_writing_guidelines TO authenticated;
GRANT ALL ON public.report_writing_guidelines TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_report_analyses TO authenticated;
GRANT ALL ON public.monthly_report_analyses TO service_role;
DROP POLICY IF EXISTS "team manages guidelines" ON public.report_writing_guidelines;
CREATE POLICY "team manages guidelines" ON public.report_writing_guidelines TO authenticated
  USING (public.admin_manages_school(school_id)) WITH CHECK (public.admin_manages_school(school_id));
DROP POLICY IF EXISTS "Staff manage report analyses" ON public.monthly_report_analyses;
CREATE POLICY "Staff manage report analyses" ON public.monthly_report_analyses TO authenticated
  USING (public.admin_manages_school(school_id)) WITH CHECK (public.admin_manages_school(school_id));