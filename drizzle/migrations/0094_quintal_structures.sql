CREATE TABLE public.company_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  nome text NOT NULL, cnpj text NOT NULL DEFAULT '', sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_entities TO authenticated;
GRANT ALL ON public.company_entities TO service_role;
ALTER TABLE public.company_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entities read" ON public.company_entities FOR SELECT TO authenticated USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "entities admin write" ON public.company_entities FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "restrita" ON public.company_entities AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));

ALTER TABLE public.realized_entries ADD COLUMN entity_id uuid REFERENCES public.company_entities(id) ON DELETE SET NULL;
ALTER TABLE public.financial_entries ADD COLUMN entity_id uuid REFERENCES public.company_entities(id) ON DELETE SET NULL;
ALTER TABLE public.expense_detail_items ADD COLUMN entity_id uuid REFERENCES public.company_entities(id) ON DELETE SET NULL;
CREATE INDEX idx_realized_entity ON public.realized_entries(school_id, entity_id, data);
CREATE INDEX idx_financial_entity ON public.financial_entries(school_id, entity_id, data);
CREATE INDEX idx_edi_entity ON public.expense_detail_items(school_id, entity_id, data);

CREATE TABLE public.entity_allocation_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.company_entities(id) ON DELETE CASCADE,
  month text NOT NULL, pct numeric NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, entity_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_allocation_rates TO authenticated;
GRANT ALL ON public.entity_allocation_rates TO service_role;
ALTER TABLE public.entity_allocation_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read rates" ON public.entity_allocation_rates FOR SELECT TO authenticated USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "admin manage rates" ON public.entity_allocation_rates FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "restrita" ON public.entity_allocation_rates AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));

CREATE TABLE public.expense_detail_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.expense_detail_groups(id) ON DELETE CASCADE,
  trip_date text NOT NULL, activity text NOT NULL DEFAULT '', paying_people integer NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0, source_row_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, source_row_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_detail_trips TO authenticated;
GRANT ALL ON public.expense_detail_trips TO service_role;
ALTER TABLE public.expense_detail_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edt_all" ON public.expense_detail_trips FOR ALL TO authenticated USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id)) WITH CHECK (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "restrita" ON public.expense_detail_trips AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));
CREATE INDEX expense_detail_trips_school_date_idx ON public.expense_detail_trips (school_id, trip_date);
CREATE TRIGGER expense_detail_trips_touch_updated_at BEFORE UPDATE ON public.expense_detail_trips FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.financial_month_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text NOT NULL DEFAULT 'review' CHECK (status IN ('review')),
  note text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_month_statuses TO authenticated;
GRANT ALL ON public.financial_month_statuses TO service_role;
ALTER TABLE public.financial_month_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY fms_select ON public.financial_month_statuses FOR SELECT TO authenticated USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY fms_write ON public.financial_month_statuses FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "restrita" ON public.financial_month_statuses AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));
CREATE TRIGGER financial_month_statuses_touch BEFORE UPDATE ON public.financial_month_statuses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.simulation_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulation_assumptions TO authenticated;
GRANT ALL ON public.simulation_assumptions TO service_role;
ALTER TABLE public.simulation_assumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sim_all ON public.simulation_assumptions FOR ALL TO authenticated USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id)) WITH CHECK (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "restrita" ON public.simulation_assumptions AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));

CREATE TABLE public.bank_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES public.company_entities(id) ON DELETE SET NULL,
  nome text NOT NULL, tipo text NOT NULL DEFAULT 'conta', saldo numeric, data_ref text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_balances TO authenticated;
GRANT ALL ON public.bank_balances TO service_role;
ALTER TABLE public.bank_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY bb_select ON public.bank_balances FOR SELECT TO authenticated USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY bb_write ON public.bank_balances FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "restrita" ON public.bank_balances AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));

CREATE OR REPLACE FUNCTION public.entity_monthly_totals(_school_id uuid, _entity_id uuid)
RETURNS TABLE(month text, tipo_valor text, valor numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH rates AS (SELECT r.month, r.pct FROM public.entity_allocation_rates r WHERE r.school_id=_school_id AND r.entity_id=_entity_id),
  src AS (
    SELECT substring(i.data from 1 for 7) m, 'receita'::text t, abs(i.valor) v, i.entity_id e
      FROM public.expense_detail_items i WHERE i.school_id=_school_id AND i.tipo='receita' AND (i.entity_id=_entity_id OR i.entity_id IS NULL)
    UNION ALL
    SELECT substring(r.data from 1 for 7), 'despesa', abs(r.valor), r.entity_id
      FROM public.realized_entries r WHERE r.school_id=_school_id AND r.tipo='despesa' AND (r.entity_id=_entity_id OR r.entity_id IS NULL)
  )
  SELECT s.m, s.t, round(sum(CASE WHEN s.e IS NOT NULL THEN s.v ELSE s.v*COALESCE(rt.pct,0) END),2)
  FROM src s LEFT JOIN rates rt ON rt.month=s.m GROUP BY s.m, s.t
$$;
REVOKE EXECUTE ON FUNCTION public.entity_monthly_totals(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.entity_monthly_totals(uuid, uuid) TO authenticated;