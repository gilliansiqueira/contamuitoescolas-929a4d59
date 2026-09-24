CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'super_admin'::public.app_role) $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) $$;

CREATE TABLE public.school_management_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  responsible_user_id uuid,
  closing_due_day integer NOT NULL DEFAULT 10 CHECK (closing_due_day BETWEEN 1 AND 28),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_management_settings TO authenticated;
GRANT ALL ON public.school_management_settings TO service_role;
ALTER TABLE public.school_management_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized staff view management settings" ON public.school_management_settings FOR SELECT TO authenticated USING (public.is_super_admin() OR (public.is_admin() AND (responsible_user_id = auth.uid() OR public.user_has_school_access(auth.uid(), school_id))));
CREATE POLICY "Super admins manage management settings" ON public.school_management_settings FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.monthly_closing_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'), waiting_for_client boolean NOT NULL DEFAULT false,
  review_complete boolean NOT NULL DEFAULT false, next_action text, internal_notes text, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (school_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_closing_cycles TO authenticated;
GRANT ALL ON public.monthly_closing_cycles TO service_role;
ALTER TABLE public.monthly_closing_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized staff view closing cycles" ON public.monthly_closing_cycles FOR SELECT TO authenticated USING (public.is_super_admin() OR (public.is_admin() AND EXISTS (SELECT 1 FROM public.school_management_settings sms WHERE sms.school_id = monthly_closing_cycles.school_id AND (sms.responsible_user_id = auth.uid() OR public.user_has_school_access(auth.uid(), sms.school_id)))));
CREATE POLICY "Authorized staff manage closing cycles" ON public.monthly_closing_cycles FOR ALL TO authenticated USING (public.is_super_admin() OR (public.is_admin() AND EXISTS (SELECT 1 FROM public.school_management_settings sms WHERE sms.school_id = monthly_closing_cycles.school_id AND sms.responsible_user_id = auth.uid()))) WITH CHECK (public.is_super_admin() OR (public.is_admin() AND EXISTS (SELECT 1 FROM public.school_management_settings sms WHERE sms.school_id = monthly_closing_cycles.school_id AND sms.responsible_user_id = auth.uid())));

CREATE TABLE public.monthly_closing_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'), step_key text NOT NULL, label text NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'automatic')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'not_applicable')),
  completed_by uuid, completed_at timestamptz, note text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (school_id, month, step_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_closing_checklist TO authenticated;
GRANT ALL ON public.monthly_closing_checklist TO service_role;
ALTER TABLE public.monthly_closing_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized staff view closing checklist" ON public.monthly_closing_checklist FOR SELECT TO authenticated USING (public.is_super_admin() OR (public.is_admin() AND EXISTS (SELECT 1 FROM public.school_management_settings sms WHERE sms.school_id = monthly_closing_checklist.school_id AND (sms.responsible_user_id = auth.uid() OR public.user_has_school_access(auth.uid(), sms.school_id)))));
CREATE POLICY "Authorized staff manage closing checklist" ON public.monthly_closing_checklist FOR ALL TO authenticated USING (public.is_super_admin() OR (public.is_admin() AND EXISTS (SELECT 1 FROM public.school_management_settings sms WHERE sms.school_id = monthly_closing_checklist.school_id AND sms.responsible_user_id = auth.uid()))) WITH CHECK (public.is_super_admin() OR (public.is_admin() AND EXISTS (SELECT 1 FROM public.school_management_settings sms WHERE sms.school_id = monthly_closing_checklist.school_id AND sms.responsible_user_id = auth.uid())));

CREATE TABLE public.report_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'), delivered_at timestamptz NOT NULL DEFAULT now(),
  delivered_by uuid, channel text, note text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (school_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_deliveries TO authenticated;
GRANT ALL ON public.report_deliveries TO service_role;
ALTER TABLE public.report_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized staff view report deliveries" ON public.report_deliveries FOR SELECT TO authenticated USING (public.is_super_admin() OR (public.is_admin() AND EXISTS (SELECT 1 FROM public.school_management_settings sms WHERE sms.school_id = report_deliveries.school_id AND (sms.responsible_user_id = auth.uid() OR public.user_has_school_access(auth.uid(), sms.school_id)))));
CREATE POLICY "Authorized staff manage report deliveries" ON public.report_deliveries FOR ALL TO authenticated USING (public.is_super_admin() OR (public.is_admin() AND EXISTS (SELECT 1 FROM public.school_management_settings sms WHERE sms.school_id = report_deliveries.school_id AND sms.responsible_user_id = auth.uid()))) WITH CHECK (public.is_super_admin() OR (public.is_admin() AND EXISTS (SELECT 1 FROM public.school_management_settings sms WHERE sms.school_id = report_deliveries.school_id AND sms.responsible_user_id = auth.uid())));

CREATE TABLE public.management_activity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month text, entity_type text NOT NULL, entity_id uuid NOT NULL, action text NOT NULL,
  old_data jsonb, new_data jsonb, changed_by uuid, changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.management_activity_history TO authenticated;
GRANT ALL ON public.management_activity_history TO service_role;
ALTER TABLE public.management_activity_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized staff view management history" ON public.management_activity_history FOR SELECT TO authenticated USING (public.is_super_admin() OR (public.is_admin() AND EXISTS (SELECT 1 FROM public.school_management_settings sms WHERE sms.school_id = management_activity_history.school_id AND (sms.responsible_user_id = auth.uid() OR public.user_has_school_access(auth.uid(), sms.school_id)))));

CREATE OR REPLACE FUNCTION public.audit_management_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row jsonb; v_old jsonb; v_school_id uuid; v_month text; v_id uuid;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_old := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_school_id := (v_row->>'school_id')::uuid; v_month := v_row->>'month'; v_id := (v_row->>'id')::uuid;
  INSERT INTO public.management_activity_history (school_id, month, entity_type, entity_id, action, old_data, new_data, changed_by)
  VALUES (v_school_id, v_month, TG_TABLE_NAME, v_id, lower(TG_OP), v_old, CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_row END, auth.uid());
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER audit_monthly_closing_cycles AFTER INSERT OR UPDATE OR DELETE ON public.monthly_closing_cycles FOR EACH ROW EXECUTE FUNCTION public.audit_management_change();
CREATE TRIGGER audit_monthly_closing_checklist AFTER INSERT OR UPDATE OR DELETE ON public.monthly_closing_checklist FOR EACH ROW EXECUTE FUNCTION public.audit_management_change();
CREATE TRIGGER audit_report_deliveries AFTER INSERT OR UPDATE OR DELETE ON public.report_deliveries FOR EACH ROW EXECUTE FUNCTION public.audit_management_change();
CREATE TRIGGER touch_school_management_settings BEFORE UPDATE ON public.school_management_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_monthly_closing_cycles BEFORE UPDATE ON public.monthly_closing_cycles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_monthly_closing_checklist BEFORE UPDATE ON public.monthly_closing_checklist FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.get_management_portfolio(_month text)
RETURNS TABLE (school_id uuid, school_name text, responsible_user_id uuid, responsible_email text, closing_due_day integer,
data_updated_through text, reconciliation_percent numeric, reconciliation_pending bigint, closing_percent numeric,
checklist_pending bigint, report_delivered boolean, period_closed boolean, waiting_for_client boolean, review_complete boolean, next_action text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito à equipe autorizada.'; END IF;
  IF _month !~ '^[0-9]{4}-[0-9]{2}$' THEN RAISE EXCEPTION 'Período inválido.'; END IF;
  RETURN QUERY SELECT s.id, s.nome, sms.responsible_user_id, rp.email, COALESCE(sms.closing_due_day, 10),
    GREATEST(fe.last_date, re.last_date, bt.last_date),
    CASE WHEN COALESCE(bt.recon_required, 0) = 0 THEN NULL ELSE round((COALESCE(bt.reconciled, 0)::numeric / bt.recon_required::numeric) * 100, 1) END,
    COALESCE(bt.recon_pending, 0),
    CASE WHEN COALESCE(cl.applicable, 0) = 0 THEN NULL ELSE round((COALESCE(cl.completed, 0)::numeric / cl.applicable::numeric) * 100, 1) END,
    COALESCE(cl.pending, 0), (rd.id IS NOT NULL),
    EXISTS (SELECT 1 FROM public.period_closures pc WHERE pc.school_id = s.id AND pc.month = _month AND pc.status = 'closed'),
    COALESCE(mc.waiting_for_client, false), COALESCE(mc.review_complete, false), mc.next_action
  FROM public.schools s
  LEFT JOIN public.school_management_settings sms ON sms.school_id = s.id
  LEFT JOIN public.profiles rp ON rp.user_id = sms.responsible_user_id
  LEFT JOIN public.monthly_closing_cycles mc ON mc.school_id = s.id AND mc.month = _month
  LEFT JOIN public.report_deliveries rd ON rd.school_id = s.id AND rd.month = _month
  LEFT JOIN LATERAL (SELECT max(f.data) AS last_date FROM public.financial_entries f WHERE f.school_id = s.id AND left(f.data, 7) <= _month) fe ON true
  LEFT JOIN LATERAL (SELECT max(r.data) AS last_date FROM public.realized_entries r WHERE r.school_id = s.id AND left(r.data, 7) <= _month) re ON true
  LEFT JOIN LATERAL (SELECT max(b.data) AS last_date, count(*) FILTER (WHERE b.recon_status <> 'nao_aplica') AS recon_required,
    count(*) FILTER (WHERE b.recon_status = 'conciliado') AS reconciled, count(*) FILTER (WHERE b.recon_status = 'pendente') AS recon_pending
    FROM public.bank_transactions b WHERE b.school_id = s.id AND left(b.data, 7) = _month) bt ON true
  LEFT JOIN LATERAL (SELECT count(*) FILTER (WHERE c.status <> 'not_applicable') AS applicable,
    count(*) FILTER (WHERE c.status = 'completed') AS completed, count(*) FILTER (WHERE c.status = 'open') AS pending
    FROM public.monthly_closing_checklist c WHERE c.school_id = s.id AND c.month = _month) cl ON true
  WHERE COALESCE(sms.is_active, true) AND (public.is_super_admin() OR sms.responsible_user_id = auth.uid() OR public.user_has_school_access(auth.uid(), s.id))
  ORDER BY s.nome;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_management_portfolio(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_management_portfolio(text) FROM anon;

CREATE INDEX school_management_settings_responsible_idx ON public.school_management_settings(responsible_user_id);
CREATE INDEX monthly_closing_cycles_school_month_idx ON public.monthly_closing_cycles(school_id, month);
CREATE INDEX monthly_closing_checklist_school_month_idx ON public.monthly_closing_checklist(school_id, month);
CREATE INDEX report_deliveries_school_month_idx ON public.report_deliveries(school_id, month);
CREATE INDEX management_activity_history_school_month_idx ON public.management_activity_history(school_id, month, changed_at DESC);