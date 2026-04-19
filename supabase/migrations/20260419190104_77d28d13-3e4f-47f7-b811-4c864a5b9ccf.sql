
-- 1. Enum de papéis
CREATE TYPE public.app_role AS ENUM ('admin', 'cliente');

-- 2. Tabela profiles (vincula usuário a uma empresa)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Tabela user_roles (separada para evitar privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Função has_role (security definer evita recursão na RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. Função current_user_school_id (retorna empresa do usuário logado)
CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- 6. Função is_admin (atalho)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
$$;

-- 7. RLS em profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (public.is_admin());

-- 8. RLS em user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 9. Trigger para criar profile automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, school_id)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'school_id', '')::UUID
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. Reescrever RLS de TODAS as tabelas financeiras
-- Padrão: admin vê tudo; cliente vê só onde school_id = current_user_school_id()

-- schools
DROP POLICY IF EXISTS "Anyone can read schools" ON public.schools;
DROP POLICY IF EXISTS "Anyone can insert schools" ON public.schools;
DROP POLICY IF EXISTS "Anyone can update schools" ON public.schools;
DROP POLICY IF EXISTS "Anyone can delete schools" ON public.schools;

CREATE POLICY "View own school or admin" ON public.schools FOR SELECT
  USING (public.is_admin() OR id = public.current_user_school_id());
CREATE POLICY "Admin manage schools insert" ON public.schools FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage schools update" ON public.schools FOR UPDATE
  USING (public.is_admin());
CREATE POLICY "Admin manage schools delete" ON public.schools FOR DELETE
  USING (public.is_admin());

-- financial_entries
DROP POLICY IF EXISTS "Anyone can read entries" ON public.financial_entries;
DROP POLICY IF EXISTS "Anyone can insert entries" ON public.financial_entries;
DROP POLICY IF EXISTS "Anyone can update entries" ON public.financial_entries;
DROP POLICY IF EXISTS "Anyone can delete entries" ON public.financial_entries;
CREATE POLICY "fe_select" ON public.financial_entries FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "fe_insert" ON public.financial_entries FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "fe_update" ON public.financial_entries FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "fe_delete" ON public.financial_entries FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- realized_entries
DROP POLICY IF EXISTS "Anyone can read realized_entries" ON public.realized_entries;
DROP POLICY IF EXISTS "Anyone can insert realized_entries" ON public.realized_entries;
DROP POLICY IF EXISTS "Anyone can update realized_entries" ON public.realized_entries;
DROP POLICY IF EXISTS "Anyone can delete realized_entries" ON public.realized_entries;
CREATE POLICY "re_select" ON public.realized_entries FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "re_insert" ON public.realized_entries FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "re_update" ON public.realized_entries FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "re_delete" ON public.realized_entries FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- sales_data
DROP POLICY IF EXISTS "Anyone can read sales_data" ON public.sales_data;
DROP POLICY IF EXISTS "Anyone can insert sales_data" ON public.sales_data;
DROP POLICY IF EXISTS "Anyone can update sales_data" ON public.sales_data;
DROP POLICY IF EXISTS "Anyone can delete sales_data" ON public.sales_data;
CREATE POLICY "sd_select" ON public.sales_data FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "sd_insert" ON public.sales_data FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "sd_update" ON public.sales_data FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "sd_delete" ON public.sales_data FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- sales_payment_methods
DROP POLICY IF EXISTS "Anyone can read sales_payment_methods" ON public.sales_payment_methods;
DROP POLICY IF EXISTS "Anyone can insert sales_payment_methods" ON public.sales_payment_methods;
DROP POLICY IF EXISTS "Anyone can update sales_payment_methods" ON public.sales_payment_methods;
DROP POLICY IF EXISTS "Anyone can delete sales_payment_methods" ON public.sales_payment_methods;
CREATE POLICY "spm_select" ON public.sales_payment_methods FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "spm_insert" ON public.sales_payment_methods FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "spm_update" ON public.sales_payment_methods FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "spm_delete" ON public.sales_payment_methods FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- sales_card_brands (school_id pode ser null = global)
DROP POLICY IF EXISTS "Anyone can read sales_card_brands" ON public.sales_card_brands;
DROP POLICY IF EXISTS "Anyone can insert sales_card_brands" ON public.sales_card_brands;
DROP POLICY IF EXISTS "Anyone can update sales_card_brands" ON public.sales_card_brands;
DROP POLICY IF EXISTS "Anyone can delete sales_card_brands" ON public.sales_card_brands;
CREATE POLICY "scb_select" ON public.sales_card_brands FOR SELECT USING (public.is_admin() OR school_id IS NULL OR school_id = public.current_user_school_id());
CREATE POLICY "scb_insert" ON public.sales_card_brands FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "scb_update" ON public.sales_card_brands FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "scb_delete" ON public.sales_card_brands FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- conversion_data
DROP POLICY IF EXISTS "Anyone can read conversion_data" ON public.conversion_data;
DROP POLICY IF EXISTS "Anyone can insert conversion_data" ON public.conversion_data;
DROP POLICY IF EXISTS "Anyone can update conversion_data" ON public.conversion_data;
DROP POLICY IF EXISTS "Anyone can delete conversion_data" ON public.conversion_data;
CREATE POLICY "cd_select" ON public.conversion_data FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "cd_insert" ON public.conversion_data FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "cd_update" ON public.conversion_data FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "cd_delete" ON public.conversion_data FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- conversion_thresholds
DROP POLICY IF EXISTS "Anyone can read conversion_thresholds" ON public.conversion_thresholds;
DROP POLICY IF EXISTS "Anyone can insert conversion_thresholds" ON public.conversion_thresholds;
DROP POLICY IF EXISTS "Anyone can update conversion_thresholds" ON public.conversion_thresholds;
DROP POLICY IF EXISTS "Anyone can delete conversion_thresholds" ON public.conversion_thresholds;
CREATE POLICY "ct_select" ON public.conversion_thresholds FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "ct_insert" ON public.conversion_thresholds FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "ct_update" ON public.conversion_thresholds FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "ct_delete" ON public.conversion_thresholds FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- conversion_icons
DROP POLICY IF EXISTS "Anyone can read conversion_icons" ON public.conversion_icons;
DROP POLICY IF EXISTS "Anyone can insert conversion_icons" ON public.conversion_icons;
DROP POLICY IF EXISTS "Anyone can update conversion_icons" ON public.conversion_icons;
DROP POLICY IF EXISTS "Anyone can delete conversion_icons" ON public.conversion_icons;
CREATE POLICY "ci_select" ON public.conversion_icons FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "ci_insert" ON public.conversion_icons FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "ci_update" ON public.conversion_icons FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "ci_delete" ON public.conversion_icons FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- kpi_definitions
DROP POLICY IF EXISTS "Anyone can read kpi_definitions" ON public.kpi_definitions;
DROP POLICY IF EXISTS "Anyone can insert kpi_definitions" ON public.kpi_definitions;
DROP POLICY IF EXISTS "Anyone can update kpi_definitions" ON public.kpi_definitions;
DROP POLICY IF EXISTS "Anyone can delete kpi_definitions" ON public.kpi_definitions;
CREATE POLICY "kd_select" ON public.kpi_definitions FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "kd_insert" ON public.kpi_definitions FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "kd_update" ON public.kpi_definitions FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "kd_delete" ON public.kpi_definitions FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- kpi_thresholds (sem school_id direto, valida via kpi_definitions)
DROP POLICY IF EXISTS "Anyone can read kpi_thresholds" ON public.kpi_thresholds;
DROP POLICY IF EXISTS "Anyone can insert kpi_thresholds" ON public.kpi_thresholds;
DROP POLICY IF EXISTS "Anyone can update kpi_thresholds" ON public.kpi_thresholds;
DROP POLICY IF EXISTS "Anyone can delete kpi_thresholds" ON public.kpi_thresholds;
CREATE POLICY "kt_select" ON public.kpi_thresholds FOR SELECT USING (
  public.is_admin() OR EXISTS (SELECT 1 FROM public.kpi_definitions kd WHERE kd.id = kpi_definition_id AND kd.school_id = public.current_user_school_id())
);
CREATE POLICY "kt_insert" ON public.kpi_thresholds FOR INSERT WITH CHECK (
  public.is_admin() OR EXISTS (SELECT 1 FROM public.kpi_definitions kd WHERE kd.id = kpi_definition_id AND kd.school_id = public.current_user_school_id())
);
CREATE POLICY "kt_update" ON public.kpi_thresholds FOR UPDATE USING (
  public.is_admin() OR EXISTS (SELECT 1 FROM public.kpi_definitions kd WHERE kd.id = kpi_definition_id AND kd.school_id = public.current_user_school_id())
);
CREATE POLICY "kt_delete" ON public.kpi_thresholds FOR DELETE USING (
  public.is_admin() OR EXISTS (SELECT 1 FROM public.kpi_definitions kd WHERE kd.id = kpi_definition_id AND kd.school_id = public.current_user_school_id())
);

-- kpi_values
DROP POLICY IF EXISTS "Anyone can read kpi_values" ON public.kpi_values;
DROP POLICY IF EXISTS "Anyone can insert kpi_values" ON public.kpi_values;
DROP POLICY IF EXISTS "Anyone can update kpi_values" ON public.kpi_values;
DROP POLICY IF EXISTS "Anyone can delete kpi_values" ON public.kpi_values;
CREATE POLICY "kv_select" ON public.kpi_values FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "kv_insert" ON public.kpi_values FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "kv_update" ON public.kpi_values FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "kv_delete" ON public.kpi_values FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- kpi_icons
DROP POLICY IF EXISTS "Anyone can read kpi_icons" ON public.kpi_icons;
DROP POLICY IF EXISTS "Anyone can insert kpi_icons" ON public.kpi_icons;
DROP POLICY IF EXISTS "Anyone can update kpi_icons" ON public.kpi_icons;
DROP POLICY IF EXISTS "Anyone can delete kpi_icons" ON public.kpi_icons;
CREATE POLICY "ki_select" ON public.kpi_icons FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "ki_insert" ON public.kpi_icons FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "ki_update" ON public.kpi_icons FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "ki_delete" ON public.kpi_icons FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- monthly_revenue
DROP POLICY IF EXISTS "Anyone can read monthly_revenue" ON public.monthly_revenue;
DROP POLICY IF EXISTS "Anyone can insert monthly_revenue" ON public.monthly_revenue;
DROP POLICY IF EXISTS "Anyone can update monthly_revenue" ON public.monthly_revenue;
DROP POLICY IF EXISTS "Anyone can delete monthly_revenue" ON public.monthly_revenue;
CREATE POLICY "mr_select" ON public.monthly_revenue FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "mr_insert" ON public.monthly_revenue FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "mr_update" ON public.monthly_revenue FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "mr_delete" ON public.monthly_revenue FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- chart_of_accounts
DROP POLICY IF EXISTS "Anyone can read chart_of_accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Anyone can insert chart_of_accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Anyone can update chart_of_accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Anyone can delete chart_of_accounts" ON public.chart_of_accounts;
CREATE POLICY "coa_select" ON public.chart_of_accounts FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "coa_insert" ON public.chart_of_accounts FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "coa_update" ON public.chart_of_accounts FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "coa_delete" ON public.chart_of_accounts FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- type_classifications
DROP POLICY IF EXISTS "Anyone can read classifications" ON public.type_classifications;
DROP POLICY IF EXISTS "Anyone can insert classifications" ON public.type_classifications;
DROP POLICY IF EXISTS "Anyone can update classifications" ON public.type_classifications;
DROP POLICY IF EXISTS "Anyone can delete classifications" ON public.type_classifications;
CREATE POLICY "tc_select" ON public.type_classifications FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "tc_insert" ON public.type_classifications FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "tc_update" ON public.type_classifications FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "tc_delete" ON public.type_classifications FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- payment_delay_rules
DROP POLICY IF EXISTS "Anyone can read delay rules" ON public.payment_delay_rules;
DROP POLICY IF EXISTS "Anyone can insert delay rules" ON public.payment_delay_rules;
DROP POLICY IF EXISTS "Anyone can update delay rules" ON public.payment_delay_rules;
DROP POLICY IF EXISTS "Anyone can delete delay rules" ON public.payment_delay_rules;
CREATE POLICY "pdr_select" ON public.payment_delay_rules FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "pdr_insert" ON public.payment_delay_rules FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "pdr_update" ON public.payment_delay_rules FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "pdr_delete" ON public.payment_delay_rules FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- exclusion_rules
DROP POLICY IF EXISTS "Anyone can read rules" ON public.exclusion_rules;
DROP POLICY IF EXISTS "Anyone can insert rules" ON public.exclusion_rules;
DROP POLICY IF EXISTS "Anyone can delete rules" ON public.exclusion_rules;
CREATE POLICY "er_select" ON public.exclusion_rules FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "er_insert" ON public.exclusion_rules FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "er_update" ON public.exclusion_rules FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "er_delete" ON public.exclusion_rules FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- upload_records
DROP POLICY IF EXISTS "Anyone can read uploads" ON public.upload_records;
DROP POLICY IF EXISTS "Anyone can insert uploads" ON public.upload_records;
DROP POLICY IF EXISTS "Anyone can delete uploads" ON public.upload_records;
CREATE POLICY "ur_select" ON public.upload_records FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "ur_insert" ON public.upload_records FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "ur_delete" ON public.upload_records FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- audit_log
DROP POLICY IF EXISTS "Anyone can read audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Anyone can insert audit log" ON public.audit_log;
CREATE POLICY "al_select" ON public.audit_log FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "al_insert" ON public.audit_log FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());

-- module_tabs
DROP POLICY IF EXISTS "Anyone can read module_tabs" ON public.module_tabs;
DROP POLICY IF EXISTS "Anyone can insert module_tabs" ON public.module_tabs;
DROP POLICY IF EXISTS "Anyone can update module_tabs" ON public.module_tabs;
DROP POLICY IF EXISTS "Anyone can delete module_tabs" ON public.module_tabs;
CREATE POLICY "mt_select" ON public.module_tabs FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "mt_insert" ON public.module_tabs FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "mt_update" ON public.module_tabs FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "mt_delete" ON public.module_tabs FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());

-- school_kpis
DROP POLICY IF EXISTS "Anyone can read school_kpis" ON public.school_kpis;
DROP POLICY IF EXISTS "Anyone can insert school_kpis" ON public.school_kpis;
DROP POLICY IF EXISTS "Anyone can update school_kpis" ON public.school_kpis;
DROP POLICY IF EXISTS "Anyone can delete school_kpis" ON public.school_kpis;
CREATE POLICY "sk_select" ON public.school_kpis FOR SELECT USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "sk_insert" ON public.school_kpis FOR INSERT WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "sk_update" ON public.school_kpis FOR UPDATE USING (public.is_admin() OR school_id = public.current_user_school_id());
CREATE POLICY "sk_delete" ON public.school_kpis FOR DELETE USING (public.is_admin() OR school_id = public.current_user_school_id());
