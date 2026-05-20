
-- ===== BLOCO A: Modelos Financeiros =====
CREATE TABLE public.financial_model_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.financial_model_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.financial_model_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  impacta_caixa boolean NOT NULL DEFAULT true,
  entra_no_resultado boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_model_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_model_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY fmt_select ON public.financial_model_templates FOR SELECT USING (true);
CREATE POLICY fmt_insert ON public.financial_model_templates FOR INSERT WITH CHECK (is_admin());
CREATE POLICY fmt_update ON public.financial_model_templates FOR UPDATE USING (is_admin());
CREATE POLICY fmt_delete ON public.financial_model_templates FOR DELETE USING (is_admin() AND is_system = false);

CREATE POLICY fmti_select ON public.financial_model_template_items FOR SELECT USING (true);
CREATE POLICY fmti_insert ON public.financial_model_template_items FOR INSERT WITH CHECK (is_admin());
CREATE POLICY fmti_update ON public.financial_model_template_items FOR UPDATE USING (is_admin());
CREATE POLICY fmti_delete ON public.financial_model_template_items FOR DELETE USING (is_admin());

CREATE TRIGGER fmt_touch BEFORE UPDATE ON public.financial_model_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.schools ADD COLUMN financial_model_template_id uuid NULL REFERENCES public.financial_model_templates(id) ON DELETE SET NULL;

-- Seed templates
DO $$
DECLARE t_escola uuid; t_clinica uuid; t_saas uuid; t_perso uuid;
BEGIN
  INSERT INTO public.financial_model_templates (name, description, is_system)
    VALUES ('Escola', 'Modelo para escolas e instituições de ensino', true) RETURNING id INTO t_escola;
  INSERT INTO public.financial_model_templates (name, description, is_system)
    VALUES ('Clínica', 'Modelo para clínicas e consultórios', true) RETURNING id INTO t_clinica;
  INSERT INTO public.financial_model_templates (name, description, is_system)
    VALUES ('SaaS', 'Modelo para empresas de software/SaaS', true) RETURNING id INTO t_saas;
  INSERT INTO public.financial_model_templates (name, description, is_system)
    VALUES ('Personalizado', 'Modelo em branco para personalizar do zero', true) RETURNING id INTO t_perso;

  -- Escola
  INSERT INTO public.financial_model_template_items (template_id, name, tipo, impacta_caixa, entra_no_resultado, sort_order) VALUES
    (t_escola, 'Receita',                 'entrada', true,  true,  1),
    (t_escola, 'Despesa',                 'saida',   true,  true,  2),
    (t_escola, 'Aporte',                  'entrada', true,  false, 3),
    (t_escola, 'Distribuição de lucros',  'saida',   true,  false, 4),
    (t_escola, 'Investimento',            'saida',   true,  false, 5),
    (t_escola, 'Resgate de investimento', 'entrada', true,  false, 6),
    (t_escola, 'Transferência',           'entrada', true,  false, 7);

  -- Clínica
  INSERT INTO public.financial_model_template_items (template_id, name, tipo, impacta_caixa, entra_no_resultado, sort_order) VALUES
    (t_clinica, 'Receita de consultas',    'entrada', true, true,  1),
    (t_clinica, 'Receita de procedimentos','entrada', true, true,  2),
    (t_clinica, 'Despesa',                 'saida',   true, true,  3),
    (t_clinica, 'Aporte',                  'entrada', true, false, 4),
    (t_clinica, 'Distribuição de lucros',  'saida',   true, false, 5);

  -- SaaS
  INSERT INTO public.financial_model_template_items (template_id, name, tipo, impacta_caixa, entra_no_resultado, sort_order) VALUES
    (t_saas, 'Receita recorrente (MRR)', 'entrada', true, true,  1),
    (t_saas, 'Receita avulsa',           'entrada', true, true,  2),
    (t_saas, 'Despesa',                  'saida',   true, true,  3),
    (t_saas, 'Aporte / Investimento',    'entrada', true, false, 4),
    (t_saas, 'Distribuição de lucros',   'saida',   true, false, 5);
END $$;

-- ===== BLOCO B: Simulação (planilha) =====
CREATE TABLE public.simulation_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  valor_unitario numeric NOT NULL DEFAULT 0,
  parcelas integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.simulation_monthly_quantities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.simulation_products(id) ON DELETE CASCADE,
  month text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, month)
);

ALTER TABLE public.simulation_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_monthly_quantities ENABLE ROW LEVEL SECURITY;

CREATE POLICY sp_select ON public.simulation_products FOR SELECT USING (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY sp_insert ON public.simulation_products FOR INSERT WITH CHECK (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY sp_update ON public.simulation_products FOR UPDATE USING (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY sp_delete ON public.simulation_products FOR DELETE USING (is_admin() OR user_has_school_access(auth.uid(), school_id));

CREATE POLICY smq_select ON public.simulation_monthly_quantities FOR SELECT USING (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY smq_insert ON public.simulation_monthly_quantities FOR INSERT WITH CHECK (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY smq_update ON public.simulation_monthly_quantities FOR UPDATE USING (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY smq_delete ON public.simulation_monthly_quantities FOR DELETE USING (is_admin() OR user_has_school_access(auth.uid(), school_id));

CREATE TRIGGER sp_touch BEFORE UPDATE ON public.simulation_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_sp_school ON public.simulation_products(school_id);
CREATE INDEX idx_smq_product ON public.simulation_monthly_quantities(product_id);
