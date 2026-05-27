
CREATE OR REPLACE FUNCTION public.is_demo_school(_id uuid)
RETURNS boolean LANGUAGE sql IMMUTABLE
AS $$ SELECT _id = 'dededede-dede-dede-dede-dededededede'::uuid $$;

CREATE OR REPLACE FUNCTION public.demo_school_id()
RETURNS uuid LANGUAGE sql IMMUTABLE
AS $$ SELECT 'dededede-dede-dede-dede-dededededede'::uuid $$;

CREATE POLICY "demo_select_schools" ON public.schools
  FOR SELECT TO anon, authenticated USING (public.is_demo_school(id));
GRANT SELECT ON public.schools TO anon;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'monthly_revenue','financial_entries','realized_entries','historical_monthly',
    'investment_entries','receivable_categories','receivable_category_values',
    'sales_analysis_channels','sales_analysis_payment_methods','sales_analysis_products',
    'sales_analysis_orders','conversion_data','conversion_thresholds','conversion_icons',
    'kpi_definitions','kpi_values','expense_ceilings','payment_delay_rules',
    'chart_of_accounts','module_tabs','exclusion_rules','category_rules','audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (public.is_demo_school(school_id))',
                   'demo_select_'||t, t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
  END LOOP;
END $$;

CREATE POLICY "demo_select_sales_analysis_order_items"
  ON public.sales_analysis_order_items FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.sales_analysis_orders o
                 WHERE o.id = sales_analysis_order_items.order_id
                 AND public.is_demo_school(o.school_id)));
GRANT SELECT ON public.sales_analysis_order_items TO anon;

CREATE POLICY "demo_select_kpi_thresholds"
  ON public.kpi_thresholds FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.kpi_definitions kd
                 WHERE kd.id = kpi_thresholds.kpi_definition_id
                 AND public.is_demo_school(kd.school_id)));
GRANT SELECT ON public.kpi_thresholds TO anon;

CREATE POLICY "demo_select_kpi_icons" ON public.kpi_icons
  FOR SELECT TO anon USING (is_global = true OR public.is_demo_school(school_id));
GRANT SELECT ON public.kpi_icons TO anon;

CREATE POLICY "demo_select_sa_icons" ON public.sa_icons
  FOR SELECT TO anon USING (is_global = true OR public.is_demo_school(school_id));
GRANT SELECT ON public.sa_icons TO anon;

GRANT SELECT ON public.financial_model_templates TO anon;
GRANT SELECT ON public.financial_model_template_items TO anon;
GRANT SELECT ON public.conversion_templates TO anon;
GRANT SELECT ON public.conversion_template_items TO anon;
GRANT SELECT ON public.kpi_templates TO anon;
GRANT SELECT ON public.kpi_template_items TO anon;
GRANT SELECT ON public.icons_library TO anon;
GRANT SELECT ON public.icon_folders TO anon;

CREATE POLICY "demo_anon_select_fmt" ON public.financial_model_templates FOR SELECT TO anon USING (true);
CREATE POLICY "demo_anon_select_fmti" ON public.financial_model_template_items FOR SELECT TO anon USING (true);
CREATE POLICY "demo_anon_select_ct" ON public.conversion_templates FOR SELECT TO anon USING (true);
CREATE POLICY "demo_anon_select_cti" ON public.conversion_template_items FOR SELECT TO anon USING (true);
CREATE POLICY "demo_anon_select_kt" ON public.kpi_templates FOR SELECT TO anon USING (true);
CREATE POLICY "demo_anon_select_kti" ON public.kpi_template_items FOR SELECT TO anon USING (true);
CREATE POLICY "demo_anon_select_il" ON public.icons_library FOR SELECT TO anon USING (true);
CREATE POLICY "demo_anon_select_if" ON public.icon_folders FOR SELECT TO anon USING (true);
