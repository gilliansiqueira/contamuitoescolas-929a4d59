-- Corrigir RLS para suportar múltiplas empresas (user_schools) além da principal (profiles.school_id)
-- Usa a função existente public.user_has_school_access(_user_id, _school_id)

-- =========== schools ===========
DROP POLICY IF EXISTS "View own school or admin" ON public.schools;
CREATE POLICY "View own school or admin" ON public.schools
  FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), id));

-- Helper macro replicada em cada tabela: substituir
-- (is_admin() OR (school_id = current_user_school_id()))
-- por
-- (is_admin() OR public.user_has_school_access(auth.uid(), school_id))

-- =========== audit_log ===========
DROP POLICY IF EXISTS al_select ON public.audit_log;
DROP POLICY IF EXISTS al_insert ON public.audit_log;
CREATE POLICY al_select ON public.audit_log FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY al_insert ON public.audit_log FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== chart_of_accounts ===========
DROP POLICY IF EXISTS coa_select ON public.chart_of_accounts;
DROP POLICY IF EXISTS coa_insert ON public.chart_of_accounts;
DROP POLICY IF EXISTS coa_update ON public.chart_of_accounts;
DROP POLICY IF EXISTS coa_delete ON public.chart_of_accounts;
CREATE POLICY coa_select ON public.chart_of_accounts FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY coa_insert ON public.chart_of_accounts FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY coa_update ON public.chart_of_accounts FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY coa_delete ON public.chart_of_accounts FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== conversion_data ===========
DROP POLICY IF EXISTS cd_select ON public.conversion_data;
DROP POLICY IF EXISTS cd_insert ON public.conversion_data;
DROP POLICY IF EXISTS cd_update ON public.conversion_data;
DROP POLICY IF EXISTS cd_delete ON public.conversion_data;
CREATE POLICY cd_select ON public.conversion_data FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY cd_insert ON public.conversion_data FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY cd_update ON public.conversion_data FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY cd_delete ON public.conversion_data FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== conversion_icons ===========
DROP POLICY IF EXISTS ci_select ON public.conversion_icons;
DROP POLICY IF EXISTS ci_insert ON public.conversion_icons;
DROP POLICY IF EXISTS ci_update ON public.conversion_icons;
DROP POLICY IF EXISTS ci_delete ON public.conversion_icons;
CREATE POLICY ci_select ON public.conversion_icons FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY ci_insert ON public.conversion_icons FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY ci_update ON public.conversion_icons FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY ci_delete ON public.conversion_icons FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== conversion_thresholds ===========
DROP POLICY IF EXISTS ct_select ON public.conversion_thresholds;
DROP POLICY IF EXISTS ct_insert ON public.conversion_thresholds;
DROP POLICY IF EXISTS ct_update ON public.conversion_thresholds;
DROP POLICY IF EXISTS ct_delete ON public.conversion_thresholds;
CREATE POLICY ct_select ON public.conversion_thresholds FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY ct_insert ON public.conversion_thresholds FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY ct_update ON public.conversion_thresholds FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY ct_delete ON public.conversion_thresholds FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== exclusion_rules ===========
DROP POLICY IF EXISTS er_select ON public.exclusion_rules;
DROP POLICY IF EXISTS er_insert ON public.exclusion_rules;
DROP POLICY IF EXISTS er_update ON public.exclusion_rules;
DROP POLICY IF EXISTS er_delete ON public.exclusion_rules;
CREATE POLICY er_select ON public.exclusion_rules FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY er_insert ON public.exclusion_rules FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY er_update ON public.exclusion_rules FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY er_delete ON public.exclusion_rules FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== financial_entries ===========
DROP POLICY IF EXISTS fe_select ON public.financial_entries;
DROP POLICY IF EXISTS fe_insert ON public.financial_entries;
DROP POLICY IF EXISTS fe_update ON public.financial_entries;
DROP POLICY IF EXISTS fe_delete ON public.financial_entries;
CREATE POLICY fe_select ON public.financial_entries FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY fe_insert ON public.financial_entries FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY fe_update ON public.financial_entries FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY fe_delete ON public.financial_entries FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== historical_monthly ===========
DROP POLICY IF EXISTS hm_select ON public.historical_monthly;
DROP POLICY IF EXISTS hm_insert ON public.historical_monthly;
DROP POLICY IF EXISTS hm_update ON public.historical_monthly;
DROP POLICY IF EXISTS hm_delete ON public.historical_monthly;
CREATE POLICY hm_select ON public.historical_monthly FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY hm_insert ON public.historical_monthly FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY hm_update ON public.historical_monthly FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY hm_delete ON public.historical_monthly FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== kpi_definitions ===========
DROP POLICY IF EXISTS kd_select ON public.kpi_definitions;
DROP POLICY IF EXISTS kd_insert ON public.kpi_definitions;
DROP POLICY IF EXISTS kd_update ON public.kpi_definitions;
DROP POLICY IF EXISTS kd_delete ON public.kpi_definitions;
CREATE POLICY kd_select ON public.kpi_definitions FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY kd_insert ON public.kpi_definitions FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY kd_update ON public.kpi_definitions FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY kd_delete ON public.kpi_definitions FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== kpi_icons (mantém regra is_global) ===========
DROP POLICY IF EXISTS ki_select ON public.kpi_icons;
DROP POLICY IF EXISTS ki_insert ON public.kpi_icons;
DROP POLICY IF EXISTS ki_update ON public.kpi_icons;
DROP POLICY IF EXISTS ki_delete ON public.kpi_icons;
CREATE POLICY ki_select ON public.kpi_icons FOR SELECT USING (
  is_admin() OR is_global = true OR public.user_has_school_access(auth.uid(), school_id)
);
CREATE POLICY ki_insert ON public.kpi_icons FOR INSERT WITH CHECK (
  (is_global = true AND is_admin()) OR (is_global = false AND (is_admin() OR public.user_has_school_access(auth.uid(), school_id)))
);
CREATE POLICY ki_update ON public.kpi_icons FOR UPDATE USING (
  (is_global = true AND is_admin()) OR (is_global = false AND (is_admin() OR public.user_has_school_access(auth.uid(), school_id)))
);
CREATE POLICY ki_delete ON public.kpi_icons FOR DELETE USING (
  (is_global = true AND is_admin()) OR (is_global = false AND (is_admin() OR public.user_has_school_access(auth.uid(), school_id)))
);

-- =========== kpi_thresholds (via kpi_definitions) ===========
DROP POLICY IF EXISTS kt_select ON public.kpi_thresholds;
DROP POLICY IF EXISTS kt_insert ON public.kpi_thresholds;
DROP POLICY IF EXISTS kt_update ON public.kpi_thresholds;
DROP POLICY IF EXISTS kt_delete ON public.kpi_thresholds;
CREATE POLICY kt_select ON public.kpi_thresholds FOR SELECT USING (
  is_admin() OR EXISTS (
    SELECT 1 FROM kpi_definitions kd
    WHERE kd.id = kpi_thresholds.kpi_definition_id
      AND public.user_has_school_access(auth.uid(), kd.school_id)
  )
);
CREATE POLICY kt_insert ON public.kpi_thresholds FOR INSERT WITH CHECK (
  is_admin() OR EXISTS (
    SELECT 1 FROM kpi_definitions kd
    WHERE kd.id = kpi_thresholds.kpi_definition_id
      AND public.user_has_school_access(auth.uid(), kd.school_id)
  )
);
CREATE POLICY kt_update ON public.kpi_thresholds FOR UPDATE USING (
  is_admin() OR EXISTS (
    SELECT 1 FROM kpi_definitions kd
    WHERE kd.id = kpi_thresholds.kpi_definition_id
      AND public.user_has_school_access(auth.uid(), kd.school_id)
  )
);
CREATE POLICY kt_delete ON public.kpi_thresholds FOR DELETE USING (
  is_admin() OR EXISTS (
    SELECT 1 FROM kpi_definitions kd
    WHERE kd.id = kpi_thresholds.kpi_definition_id
      AND public.user_has_school_access(auth.uid(), kd.school_id)
  )
);

-- =========== kpi_values ===========
DROP POLICY IF EXISTS kv_select ON public.kpi_values;
DROP POLICY IF EXISTS kv_insert ON public.kpi_values;
DROP POLICY IF EXISTS kv_update ON public.kpi_values;
DROP POLICY IF EXISTS kv_delete ON public.kpi_values;
CREATE POLICY kv_select ON public.kpi_values FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY kv_insert ON public.kpi_values FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY kv_update ON public.kpi_values FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY kv_delete ON public.kpi_values FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== module_tabs ===========
DROP POLICY IF EXISTS mt_select ON public.module_tabs;
DROP POLICY IF EXISTS mt_insert ON public.module_tabs;
DROP POLICY IF EXISTS mt_update ON public.module_tabs;
DROP POLICY IF EXISTS mt_delete ON public.module_tabs;
CREATE POLICY mt_select ON public.module_tabs FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY mt_insert ON public.module_tabs FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY mt_update ON public.module_tabs FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY mt_delete ON public.module_tabs FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== monthly_revenue ===========
DROP POLICY IF EXISTS mr_select ON public.monthly_revenue;
DROP POLICY IF EXISTS mr_insert ON public.monthly_revenue;
DROP POLICY IF EXISTS mr_update ON public.monthly_revenue;
DROP POLICY IF EXISTS mr_delete ON public.monthly_revenue;
CREATE POLICY mr_select ON public.monthly_revenue FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY mr_insert ON public.monthly_revenue FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY mr_update ON public.monthly_revenue FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY mr_delete ON public.monthly_revenue FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== payment_delay_rules ===========
DROP POLICY IF EXISTS pdr_select ON public.payment_delay_rules;
DROP POLICY IF EXISTS pdr_insert ON public.payment_delay_rules;
DROP POLICY IF EXISTS pdr_update ON public.payment_delay_rules;
DROP POLICY IF EXISTS pdr_delete ON public.payment_delay_rules;
CREATE POLICY pdr_select ON public.payment_delay_rules FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY pdr_insert ON public.payment_delay_rules FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY pdr_update ON public.payment_delay_rules FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY pdr_delete ON public.payment_delay_rules FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== realized_entries ===========
DROP POLICY IF EXISTS re_select ON public.realized_entries;
DROP POLICY IF EXISTS re_insert ON public.realized_entries;
DROP POLICY IF EXISTS re_update ON public.realized_entries;
DROP POLICY IF EXISTS re_delete ON public.realized_entries;
CREATE POLICY re_select ON public.realized_entries FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY re_insert ON public.realized_entries FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY re_update ON public.realized_entries FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY re_delete ON public.realized_entries FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== receivable_categories ===========
DROP POLICY IF EXISTS rc_select ON public.receivable_categories;
DROP POLICY IF EXISTS rc_insert ON public.receivable_categories;
DROP POLICY IF EXISTS rc_update ON public.receivable_categories;
DROP POLICY IF EXISTS rc_delete ON public.receivable_categories;
CREATE POLICY rc_select ON public.receivable_categories FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY rc_insert ON public.receivable_categories FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY rc_update ON public.receivable_categories FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY rc_delete ON public.receivable_categories FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== receivable_category_values ===========
DROP POLICY IF EXISTS rcv_select ON public.receivable_category_values;
DROP POLICY IF EXISTS rcv_insert ON public.receivable_category_values;
DROP POLICY IF EXISTS rcv_update ON public.receivable_category_values;
DROP POLICY IF EXISTS rcv_delete ON public.receivable_category_values;
CREATE POLICY rcv_select ON public.receivable_category_values FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY rcv_insert ON public.receivable_category_values FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY rcv_update ON public.receivable_category_values FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY rcv_delete ON public.receivable_category_values FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== sa_icons (mantém regra is_global) ===========
DROP POLICY IF EXISTS sai_select ON public.sa_icons;
DROP POLICY IF EXISTS sai_insert ON public.sa_icons;
DROP POLICY IF EXISTS sai_update ON public.sa_icons;
DROP POLICY IF EXISTS sai_delete ON public.sa_icons;
CREATE POLICY sai_select ON public.sa_icons FOR SELECT USING (
  is_admin() OR is_global = true OR public.user_has_school_access(auth.uid(), school_id)
);
CREATE POLICY sai_insert ON public.sa_icons FOR INSERT WITH CHECK (
  (is_global = true AND is_admin()) OR (is_global = false AND (is_admin() OR public.user_has_school_access(auth.uid(), school_id)))
);
CREATE POLICY sai_update ON public.sa_icons FOR UPDATE USING (
  (is_global = true AND is_admin()) OR (is_global = false AND (is_admin() OR public.user_has_school_access(auth.uid(), school_id)))
);
CREATE POLICY sai_delete ON public.sa_icons FOR DELETE USING (
  (is_global = true AND is_admin()) OR (is_global = false AND (is_admin() OR public.user_has_school_access(auth.uid(), school_id)))
);

-- =========== sales_analysis_channels ===========
DROP POLICY IF EXISTS sac_select ON public.sales_analysis_channels;
DROP POLICY IF EXISTS sac_insert ON public.sales_analysis_channels;
DROP POLICY IF EXISTS sac_update ON public.sales_analysis_channels;
DROP POLICY IF EXISTS sac_delete ON public.sales_analysis_channels;
CREATE POLICY sac_select ON public.sales_analysis_channels FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sac_insert ON public.sales_analysis_channels FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sac_update ON public.sales_analysis_channels FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sac_delete ON public.sales_analysis_channels FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== sales_analysis_orders ===========
DROP POLICY IF EXISTS sao_select ON public.sales_analysis_orders;
DROP POLICY IF EXISTS sao_insert ON public.sales_analysis_orders;
DROP POLICY IF EXISTS sao_update ON public.sales_analysis_orders;
DROP POLICY IF EXISTS sao_delete ON public.sales_analysis_orders;
CREATE POLICY sao_select ON public.sales_analysis_orders FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sao_insert ON public.sales_analysis_orders FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sao_update ON public.sales_analysis_orders FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sao_delete ON public.sales_analysis_orders FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== sales_analysis_order_items (via orders) ===========
DROP POLICY IF EXISTS saoi_select ON public.sales_analysis_order_items;
DROP POLICY IF EXISTS saoi_insert ON public.sales_analysis_order_items;
DROP POLICY IF EXISTS saoi_update ON public.sales_analysis_order_items;
DROP POLICY IF EXISTS saoi_delete ON public.sales_analysis_order_items;
CREATE POLICY saoi_select ON public.sales_analysis_order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM sales_analysis_orders o WHERE o.id = sales_analysis_order_items.order_id AND (is_admin() OR public.user_has_school_access(auth.uid(), o.school_id)))
);
CREATE POLICY saoi_insert ON public.sales_analysis_order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM sales_analysis_orders o WHERE o.id = sales_analysis_order_items.order_id AND (is_admin() OR public.user_has_school_access(auth.uid(), o.school_id)))
);
CREATE POLICY saoi_update ON public.sales_analysis_order_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM sales_analysis_orders o WHERE o.id = sales_analysis_order_items.order_id AND (is_admin() OR public.user_has_school_access(auth.uid(), o.school_id)))
);
CREATE POLICY saoi_delete ON public.sales_analysis_order_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM sales_analysis_orders o WHERE o.id = sales_analysis_order_items.order_id AND (is_admin() OR public.user_has_school_access(auth.uid(), o.school_id)))
);

-- =========== sales_analysis_payment_methods ===========
DROP POLICY IF EXISTS sapm_select ON public.sales_analysis_payment_methods;
DROP POLICY IF EXISTS sapm_insert ON public.sales_analysis_payment_methods;
DROP POLICY IF EXISTS sapm_update ON public.sales_analysis_payment_methods;
DROP POLICY IF EXISTS sapm_delete ON public.sales_analysis_payment_methods;
CREATE POLICY sapm_select ON public.sales_analysis_payment_methods FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sapm_insert ON public.sales_analysis_payment_methods FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sapm_update ON public.sales_analysis_payment_methods FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sapm_delete ON public.sales_analysis_payment_methods FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== sales_analysis_products ===========
DROP POLICY IF EXISTS sap_select ON public.sales_analysis_products;
DROP POLICY IF EXISTS sap_insert ON public.sales_analysis_products;
DROP POLICY IF EXISTS sap_update ON public.sales_analysis_products;
DROP POLICY IF EXISTS sap_delete ON public.sales_analysis_products;
CREATE POLICY sap_select ON public.sales_analysis_products FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sap_insert ON public.sales_analysis_products FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sap_update ON public.sales_analysis_products FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sap_delete ON public.sales_analysis_products FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== sales_card_brands ===========
DROP POLICY IF EXISTS scb_select ON public.sales_card_brands;
DROP POLICY IF EXISTS scb_insert ON public.sales_card_brands;
DROP POLICY IF EXISTS scb_update ON public.sales_card_brands;
DROP POLICY IF EXISTS scb_delete ON public.sales_card_brands;
CREATE POLICY scb_select ON public.sales_card_brands FOR SELECT USING (
  is_admin() OR school_id IS NULL OR public.user_has_school_access(auth.uid(), school_id)
);
CREATE POLICY scb_insert ON public.sales_card_brands FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY scb_update ON public.sales_card_brands FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY scb_delete ON public.sales_card_brands FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== sales_data ===========
DROP POLICY IF EXISTS sd_select ON public.sales_data;
DROP POLICY IF EXISTS sd_insert ON public.sales_data;
DROP POLICY IF EXISTS sd_update ON public.sales_data;
DROP POLICY IF EXISTS sd_delete ON public.sales_data;
CREATE POLICY sd_select ON public.sales_data FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sd_insert ON public.sales_data FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sd_update ON public.sales_data FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sd_delete ON public.sales_data FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== sales_payment_methods ===========
DROP POLICY IF EXISTS spm_select ON public.sales_payment_methods;
DROP POLICY IF EXISTS spm_insert ON public.sales_payment_methods;
DROP POLICY IF EXISTS spm_update ON public.sales_payment_methods;
DROP POLICY IF EXISTS spm_delete ON public.sales_payment_methods;
CREATE POLICY spm_select ON public.sales_payment_methods FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY spm_insert ON public.sales_payment_methods FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY spm_update ON public.sales_payment_methods FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY spm_delete ON public.sales_payment_methods FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== school_kpis ===========
DROP POLICY IF EXISTS sk_select ON public.school_kpis;
DROP POLICY IF EXISTS sk_insert ON public.school_kpis;
DROP POLICY IF EXISTS sk_update ON public.school_kpis;
DROP POLICY IF EXISTS sk_delete ON public.school_kpis;
CREATE POLICY sk_select ON public.school_kpis FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sk_insert ON public.school_kpis FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sk_update ON public.school_kpis FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sk_delete ON public.school_kpis FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== type_classifications ===========
DROP POLICY IF EXISTS tc_select ON public.type_classifications;
DROP POLICY IF EXISTS tc_insert ON public.type_classifications;
DROP POLICY IF EXISTS tc_update ON public.type_classifications;
DROP POLICY IF EXISTS tc_delete ON public.type_classifications;
CREATE POLICY tc_select ON public.type_classifications FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY tc_insert ON public.type_classifications FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY tc_update ON public.type_classifications FOR UPDATE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY tc_delete ON public.type_classifications FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));

-- =========== upload_records ===========
DROP POLICY IF EXISTS ur_select ON public.upload_records;
DROP POLICY IF EXISTS ur_insert ON public.upload_records;
DROP POLICY IF EXISTS ur_delete ON public.upload_records;
CREATE POLICY ur_select ON public.upload_records FOR SELECT USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY ur_insert ON public.upload_records FOR INSERT WITH CHECK (is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY ur_delete ON public.upload_records FOR DELETE USING (is_admin() OR public.user_has_school_access(auth.uid(), school_id));