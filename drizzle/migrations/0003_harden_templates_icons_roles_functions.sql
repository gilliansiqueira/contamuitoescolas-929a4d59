-- 1. Conversion templates: writes restricted to admins, reads to signed-in users
DROP POLICY IF EXISTS "Anyone can delete conversion_templates" ON public.conversion_templates;
DROP POLICY IF EXISTS "Anyone can insert conversion_templates" ON public.conversion_templates;
DROP POLICY IF EXISTS "Anyone can update conversion_templates" ON public.conversion_templates;
DROP POLICY IF EXISTS "Anyone can read conversion_templates" ON public.conversion_templates;
DROP POLICY IF EXISTS "demo_anon_select_ct" ON public.conversion_templates;
CREATE POLICY "ct_select" ON public.conversion_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "ct_insert" ON public.conversion_templates FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "ct_update" ON public.conversion_templates FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "ct_delete" ON public.conversion_templates FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can delete conversion_template_items" ON public.conversion_template_items;
DROP POLICY IF EXISTS "Anyone can insert conversion_template_items" ON public.conversion_template_items;
DROP POLICY IF EXISTS "Anyone can update conversion_template_items" ON public.conversion_template_items;
DROP POLICY IF EXISTS "Anyone can read conversion_template_items" ON public.conversion_template_items;
DROP POLICY IF EXISTS "demo_anon_select_cti" ON public.conversion_template_items;
CREATE POLICY "cti_select" ON public.conversion_template_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "cti_insert" ON public.conversion_template_items FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "cti_update" ON public.conversion_template_items FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "cti_delete" ON public.conversion_template_items FOR DELETE TO authenticated USING (public.is_admin());

REVOKE ALL ON public.conversion_templates FROM anon;
REVOKE ALL ON public.conversion_template_items FROM anon;

-- 2. KPI templates
DROP POLICY IF EXISTS "Anyone can delete kpi_templates" ON public.kpi_templates;
DROP POLICY IF EXISTS "Anyone can insert kpi_templates" ON public.kpi_templates;
DROP POLICY IF EXISTS "Anyone can update kpi_templates" ON public.kpi_templates;
DROP POLICY IF EXISTS "Anyone can read kpi_templates" ON public.kpi_templates;
DROP POLICY IF EXISTS "demo_anon_select_kt" ON public.kpi_templates;
CREATE POLICY "kt_select" ON public.kpi_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "kt_insert" ON public.kpi_templates FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "kt_update" ON public.kpi_templates FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "kt_delete" ON public.kpi_templates FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can delete kpi_template_items" ON public.kpi_template_items;
DROP POLICY IF EXISTS "Anyone can insert kpi_template_items" ON public.kpi_template_items;
DROP POLICY IF EXISTS "Anyone can update kpi_template_items" ON public.kpi_template_items;
DROP POLICY IF EXISTS "Anyone can read kpi_template_items" ON public.kpi_template_items;
DROP POLICY IF EXISTS "demo_anon_select_kti" ON public.kpi_template_items;
CREATE POLICY "kti_select" ON public.kpi_template_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "kti_insert" ON public.kpi_template_items FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "kti_update" ON public.kpi_template_items FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "kti_delete" ON public.kpi_template_items FOR DELETE TO authenticated USING (public.is_admin());

REVOKE ALL ON public.kpi_templates FROM anon;
REVOKE ALL ON public.kpi_template_items FROM anon;

-- 3. Financial model templates: reads limited to signed-in users
DROP POLICY IF EXISTS "fmt_select" ON public.financial_model_templates;
DROP POLICY IF EXISTS "demo_anon_select_fmt" ON public.financial_model_templates;
CREATE POLICY "fmt_select" ON public.financial_model_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "fmti_select" ON public.financial_model_template_items;
DROP POLICY IF EXISTS "demo_anon_select_fmti" ON public.financial_model_template_items;
CREATE POLICY "fmti_select" ON public.financial_model_template_items FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.financial_model_templates FROM anon;
REVOKE ALL ON public.financial_model_template_items FROM anon;

-- 4. Icon library: reads limited to signed-in users
DROP POLICY IF EXISTS "il_select" ON public.icons_library;
DROP POLICY IF EXISTS "demo_anon_select_il" ON public.icons_library;
CREATE POLICY "il_select" ON public.icons_library FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "if_select" ON public.icon_folders;
DROP POLICY IF EXISTS "demo_anon_select_if" ON public.icon_folders;
CREATE POLICY "if_select" ON public.icon_folders FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.icons_library FROM anon;
REVOKE ALL ON public.icon_folders FROM anon;

-- 5. Storage buckets: public read stays, writes require sign-in
DROP POLICY IF EXISTS "Anyone can upload KPI icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update KPI icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete KPI icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload card brand icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update card brand icons" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete card brand icons" ON storage.objects;
CREATE POLICY "Signed-in users can upload icons" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('kpi-icons','card-brand-icons'));
CREATE POLICY "Signed-in users can update icons" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('kpi-icons','card-brand-icons')) WITH CHECK (bucket_id IN ('kpi-icons','card-brand-icons'));
CREATE POLICY "Signed-in users can delete icons" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('kpi-icons','card-brand-icons'));

-- 6. user_roles: admins cannot change their own roles (no self privilege escalation)
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can grant roles to others" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin() AND user_id <> auth.uid());
CREATE POLICY "Admins can update roles of others" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin() AND user_id <> auth.uid()) WITH CHECK (public.is_admin() AND user_id <> auth.uid());
CREATE POLICY "Admins can delete roles of others" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin() AND user_id <> auth.uid());
REVOKE ALL ON public.user_roles FROM anon;

-- 7. Fixed search_path on remaining functions
ALTER FUNCTION public.demo_school_id() SET search_path = public;
ALTER FUNCTION public.is_demo_school(uuid) SET search_path = public;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;

-- 8. Trigger-only SECURITY DEFINER functions are not directly callable from the API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_conversion_data_closed_proj() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_financial_entries_closed_proj() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_historical_monthly_closed_proj() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_kpi_values_closed_month() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_monthly_revenue_closed_month() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_realized_entries_closed_month() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_receivable_values_closed_month() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_sales_data_closed_proj() FROM anon, authenticated, public;

-- Policy/helper functions: keep EXECUTE only for signed-in users
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_school_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_user_school_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_school_access(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.user_has_school_access(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_month_closed(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_month_closed(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_month_closed_for_module(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_month_closed_for_module(uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_date_in_closed_month(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_date_in_closed_month(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_date_in_closed_month_for_module(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_date_in_closed_month_for_module(uuid, text, text) TO authenticated;