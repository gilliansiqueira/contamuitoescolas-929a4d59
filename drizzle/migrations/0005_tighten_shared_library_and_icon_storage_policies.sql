CREATE OR REPLACE FUNCTION public.is_platform_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND school_id IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.user_schools WHERE user_id = auth.uid())
  )
$$;

DROP POLICY IF EXISTS cti_select ON public.conversion_template_items;
CREATE POLICY cti_select ON public.conversion_template_items FOR SELECT TO authenticated USING (public.is_platform_member());
DROP POLICY IF EXISTS ct_select ON public.conversion_templates;
CREATE POLICY ct_select ON public.conversion_templates FOR SELECT TO authenticated USING (public.is_platform_member());
DROP POLICY IF EXISTS fmti_select ON public.financial_model_template_items;
CREATE POLICY fmti_select ON public.financial_model_template_items FOR SELECT TO authenticated USING (public.is_platform_member());
DROP POLICY IF EXISTS fmt_select ON public.financial_model_templates;
CREATE POLICY fmt_select ON public.financial_model_templates FOR SELECT TO authenticated USING (public.is_platform_member());
DROP POLICY IF EXISTS if_select ON public.icon_folders;
CREATE POLICY if_select ON public.icon_folders FOR SELECT TO authenticated USING (public.is_platform_member());
DROP POLICY IF EXISTS il_select ON public.icons_library;
CREATE POLICY il_select ON public.icons_library FOR SELECT TO authenticated USING (public.is_platform_member());
DROP POLICY IF EXISTS kti_select ON public.kpi_template_items;
CREATE POLICY kti_select ON public.kpi_template_items FOR SELECT TO authenticated USING (public.is_platform_member());
DROP POLICY IF EXISTS kt_select ON public.kpi_templates;
CREATE POLICY kt_select ON public.kpi_templates FOR SELECT TO authenticated USING (public.is_platform_member());
DROP POLICY IF EXISTS ki_select ON public.kpi_icons;
CREATE POLICY ki_select ON public.kpi_icons FOR SELECT TO anon, authenticated USING (
  is_global OR public.is_demo_school(school_id) OR public.is_admin()
  OR (school_id IS NOT NULL AND public.user_has_school_access(auth.uid(), school_id))
);

DROP POLICY IF EXISTS "Signed-in users can upload icons" ON storage.objects;
DROP POLICY IF EXISTS "Signed-in users can update icons" ON storage.objects;
DROP POLICY IF EXISTS "Signed-in users can delete icons" ON storage.objects;
CREATE POLICY "Members can upload own icons" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('kpi-icons','card-brand-icons') AND owner = auth.uid() AND public.is_platform_member());
CREATE POLICY "Owners or admins can update icons" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('kpi-icons','card-brand-icons') AND (owner = auth.uid() OR public.is_admin()))
  WITH CHECK (bucket_id IN ('kpi-icons','card-brand-icons') AND (owner = auth.uid() OR public.is_admin()));
CREATE POLICY "Owners or admins can delete icons" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('kpi-icons','card-brand-icons') AND (owner = auth.uid() OR public.is_admin()));