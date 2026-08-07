CREATE TABLE public.sales_custom_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Novo gráfico',
  source text NOT NULL DEFAULT 'vendas',
  chart_type text NOT NULL DEFAULT 'bar',
  metric text NOT NULL DEFAULT 'faturamento',
  group_by text NOT NULL DEFAULT 'mes',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_custom_charts TO authenticated;
GRANT ALL ON public.sales_custom_charts TO service_role;

ALTER TABLE public.sales_custom_charts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scc_select" ON public.sales_custom_charts FOR SELECT TO authenticated
USING (public.is_admin() OR school_id = public.current_user_school_id());

CREATE POLICY "scc_insert" ON public.sales_custom_charts FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());

CREATE POLICY "scc_update" ON public.sales_custom_charts FOR UPDATE TO authenticated
USING (public.is_admin() OR school_id = public.current_user_school_id())
WITH CHECK (public.is_admin() OR school_id = public.current_user_school_id());

CREATE POLICY "scc_delete" ON public.sales_custom_charts FOR DELETE TO authenticated
USING (public.is_admin() OR school_id = public.current_user_school_id());

CREATE TRIGGER scc_touch BEFORE UPDATE ON public.sales_custom_charts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();