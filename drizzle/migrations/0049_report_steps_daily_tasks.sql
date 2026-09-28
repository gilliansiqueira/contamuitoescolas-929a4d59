ALTER TABLE public.closing_step_templates
  ADD COLUMN IF NOT EXISTS check_kind text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS group_key text,
  ADD COLUMN IF NOT EXISTS link_tab text;

-- Tarefas do dia
CREATE TABLE public.daily_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  check_kind text NOT NULL DEFAULT 'manual',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_task_templates TO authenticated;
GRANT ALL ON public.daily_task_templates TO service_role;
ALTER TABLE public.daily_task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view daily templates" ON public.daily_task_templates FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Super admin manage daily templates" ON public.daily_task_templates FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.daily_task_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  day date NOT NULL,
  task_key text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  check_kind text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'open',
  source text NOT NULL DEFAULT 'manual',
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, day, task_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_task_checklist TO authenticated;
GRANT ALL ON public.daily_task_checklist TO service_role;
ALTER TABLE public.daily_task_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view daily tasks" ON public.daily_task_checklist FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id)));
CREATE POLICY "Staff manage daily tasks" ON public.daily_task_checklist FOR ALL TO authenticated
  USING (public.is_super_admin() OR (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id)))
  WITH CHECK (public.is_super_admin() OR (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id)));

-- Análise do relatório
CREATE TABLE public.monthly_report_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month text NOT NULL,
  content text NOT NULL DEFAULT '',
  generated_at timestamptz,
  edited_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_report_analyses TO authenticated;
GRANT ALL ON public.monthly_report_analyses TO service_role;
ALTER TABLE public.monthly_report_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage report analyses" ON public.monthly_report_analyses FOR ALL TO authenticated
  USING (public.is_super_admin() OR (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id)))
  WITH CHECK (public.is_super_admin() OR (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id)));

CREATE OR REPLACE FUNCTION public.ensure_monthly_checklist(_school_id uuid, _month text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_step record;
  v_inserted integer := 0;
  v_start date;
  v_end date;
  v_ok boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à equipe autorizada.';
  END IF;
  IF _month !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'Período inválido.';
  END IF;
  v_start := (_month || '-01')::date;
  v_end := (v_start + interval '1 month')::date;

  FOR v_step IN
    SELECT t.step_key, COALESCE(o.label, t.label) AS label, t.sort_order
    FROM public.closing_step_templates t
    LEFT JOIN public.school_closing_step_overrides o ON o.school_id = _school_id AND o.template_id = t.id
    WHERE t.active AND COALESCE(o.disabled, false) = false
    UNION ALL
    SELECT o.step_key, o.label, 1000 + o.sort_order
    FROM public.school_closing_step_overrides o
    WHERE o.school_id = _school_id AND o.template_id IS NULL AND o.disabled = false AND o.label IS NOT NULL
  LOOP
    INSERT INTO public.monthly_closing_checklist (school_id, month, step_key, label, source, status)
    SELECT _school_id, _month, v_step.step_key, v_step.label, 'automatic', 'open'
    WHERE NOT EXISTS (SELECT 1 FROM public.monthly_closing_checklist c
      WHERE c.school_id = _school_id AND c.month = _month AND c.step_key = v_step.step_key);
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;

  -- Conferências automáticas (nunca desfazem marcações da equipe)
  v_ok := EXISTS (SELECT 1 FROM public.bank_transactions b WHERE b.school_id = _school_id AND b.data >= v_start::text AND b.data < v_end::text AND NOT b.is_forecast)
      AND NOT EXISTS (SELECT 1 FROM public.bank_transactions b WHERE b.school_id = _school_id AND b.data >= v_start::text AND b.data < v_end::text AND NOT b.is_forecast AND b.recon_status = 'pendente');
  IF v_ok THEN
    UPDATE public.monthly_closing_checklist SET status = 'completed', source = 'auto', completed_at = now(), note = 'Conferido automaticamente pelo Fluxo Bancário', updated_at = now()
    WHERE school_id = _school_id AND month = _month AND status = 'open' AND step_key IN ('proj_realizado', 'desp_conciliacao');
  END IF;

  IF EXISTS (SELECT 1 FROM public.upload_records u WHERE u.school_id = _school_id AND u.uploaded_at >= v_start AND u.tipo IN ('sponte', 'contas_pagar', 'cheque', 'cartao')) THEN
    UPDATE public.monthly_closing_checklist SET status = 'completed', source = 'auto', completed_at = now(), note = 'Projeção atualizada por upload', updated_at = now()
    WHERE school_id = _school_id AND month = _month AND status = 'open' AND step_key = 'proj_futuras';
  END IF;

  IF EXISTS (SELECT 1 FROM public.upload_records u WHERE u.school_id = _school_id AND u.uploaded_at >= v_start AND u.tipo IN ('centro_custos', 'realizado')) THEN
    UPDATE public.monthly_closing_checklist SET status = 'completed', source = 'auto', completed_at = now(), note = 'Contas pagas enviadas', updated_at = now()
    WHERE school_id = _school_id AND month = _month AND status = 'open' AND step_key = 'desp_contas_pagas';
  END IF;

  RETURN v_inserted;
END;
$function$;

-- Dicas: há dados lançados no mês?
CREATE OR REPLACE FUNCTION public.get_report_step_hints(_school_id uuid, _month text)
 RETURNS TABLE(step_key text, has_data boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT * FROM (VALUES
    ('kpis', EXISTS (SELECT 1 FROM public.kpi_values WHERE school_id = _school_id AND month = _month)),
    ('receitas_categoria', EXISTS (SELECT 1 FROM public.receivable_category_values WHERE school_id = _school_id AND month = _month)),
    ('vendas', EXISTS (SELECT 1 FROM public.sales_data WHERE school_id = _school_id AND month = _month)),
    ('contatos_matriculas', EXISTS (SELECT 1 FROM public.conversion_data WHERE school_id = _school_id AND month = _month))
  ) AS v(step_key, has_data)
  WHERE public.is_admin();
$$;

-- Etapa de envio concluída marca o relatório como entregue
CREATE OR REPLACE FUNCTION public.report_step_delivery_trigger()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.step_key = 'envio_cliente' AND NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
    INSERT INTO public.report_deliveries (school_id, month, delivered_at, delivered_by, channel, note)
    SELECT NEW.school_id, NEW.month, now(), auth.uid(), 'relatorio', 'Marcado pela etapa de envio'
    WHERE NOT EXISTS (SELECT 1 FROM public.report_deliveries r WHERE r.school_id = NEW.school_id AND r.month = NEW.month);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_report_step_delivery AFTER UPDATE ON public.monthly_closing_checklist
  FOR EACH ROW EXECUTE FUNCTION public.report_step_delivery_trigger();

CREATE OR REPLACE FUNCTION public.ensure_daily_tasks(_school_id uuid, _day date)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à equipe autorizada.';
  END IF;
  INSERT INTO public.daily_task_checklist (school_id, day, task_key, label, sort_order, check_kind)
  SELECT _school_id, _day, t.task_key, t.label, t.sort_order, t.check_kind
  FROM public.daily_task_templates t WHERE t.active
  ON CONFLICT (school_id, day, task_key) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF EXISTS (SELECT 1 FROM public.bank_transactions b WHERE b.school_id = _school_id AND NOT b.is_forecast AND b.data <= _day::text)
     AND NOT EXISTS (SELECT 1 FROM public.bank_transactions b WHERE b.school_id = _school_id AND NOT b.is_forecast AND b.data <= _day::text AND b.data >= '2026-09-01' AND b.recon_status = 'pendente') THEN
    UPDATE public.daily_task_checklist SET status = 'completed', source = 'auto', completed_at = now(), updated_at = now()
    WHERE school_id = _school_id AND day = _day AND task_key = 'conciliacao' AND status = 'open';
  END IF;
  RETURN v_count;
END;
$$;