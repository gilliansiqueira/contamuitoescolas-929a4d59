CREATE OR REPLACE FUNCTION public._refresh_report_progress(_school_id uuid, _month text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_step record; v_inserted int := 0; v_start date; v_end date; v_due timestamptz;
  v_recon boolean; v_proj boolean; v_pagas boolean; v_kdef int; v_kval int;
  r record;
BEGIN
  IF _month !~ '^[0-9]{4}-[0-9]{2}$' THEN RETURN 0; END IF;
  v_start := (_month || '-01')::date;
  v_end := (v_start + interval '1 month')::date;
  v_due := (public.report_due_date(_month) + 1)::timestamptz;

  FOR v_step IN
    SELECT t.step_key, COALESCE(o.label, t.label) AS label
    FROM public.closing_step_templates t
    LEFT JOIN public.school_closing_step_overrides o ON o.school_id = _school_id AND o.template_id = t.id
    WHERE t.active AND COALESCE(o.disabled, false) = false
    UNION ALL
    SELECT o.step_key, o.label FROM public.school_closing_step_overrides o
    WHERE o.school_id = _school_id AND o.template_id IS NULL AND o.disabled = false AND o.label IS NOT NULL
  LOOP
    INSERT INTO public.monthly_closing_checklist (school_id, month, step_key, label, source, status)
    SELECT _school_id, _month, v_step.step_key, v_step.label, 'automatic', 'open'
    WHERE NOT EXISTS (SELECT 1 FROM public.monthly_closing_checklist c WHERE c.school_id = _school_id AND c.month = _month AND c.step_key = v_step.step_key);
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;

  v_recon := EXISTS (SELECT 1 FROM public.bank_transactions b WHERE b.school_id = _school_id AND b.data >= v_start::text AND b.data < v_end::text AND NOT b.is_forecast)
    AND NOT EXISTS (SELECT 1 FROM public.bank_transactions b WHERE b.school_id = _school_id AND b.data >= v_start::text AND b.data < v_end::text AND NOT b.is_forecast AND b.recon_status = 'pendente');
  v_proj := EXISTS (SELECT 1 FROM public.upload_records u WHERE u.school_id = _school_id AND u.uploaded_at >= v_start AND u.uploaded_at < v_due AND u.tipo IN ('sponte','contas_pagar','cheque','cartao'));
  v_pagas := EXISTS (SELECT 1 FROM public.upload_records u WHERE u.school_id = _school_id AND u.uploaded_at >= v_start AND u.uploaded_at < v_due AND u.tipo IN ('centro_custos','realizado'))
    OR EXISTS (SELECT 1 FROM public.realized_entries e WHERE e.school_id = _school_id AND e.data >= v_start::text AND e.data < v_end::text AND e.created_at < v_due);
  SELECT count(*) INTO v_kdef FROM public.kpi_definitions WHERE school_id = _school_id AND enabled;
  SELECT count(DISTINCT v.kpi_definition_id) INTO v_kval FROM public.kpi_values v JOIN public.kpi_definitions d ON d.id = v.kpi_definition_id AND d.enabled
    WHERE v.school_id = _school_id AND v.month = _month AND v.value IS NOT NULL;

  FOR r IN SELECT * FROM (VALUES
    ('proj_realizado', v_recon, 'Conciliação do mês em 100%'),
    ('desp_conciliacao', v_recon, 'Conciliação do mês em 100%'),
    ('proj_futuras', v_proj, 'Projeção atualizada por upload'),
    ('desp_contas_pagas', v_pagas, 'Despesas do mês lançadas'),
    ('kpis', v_kdef > 0 AND v_kval >= v_kdef, format('%s de %s KPIs preenchidos', v_kval, v_kdef)),
    ('receitas_categoria', EXISTS (SELECT 1 FROM public.receivable_category_values WHERE school_id = _school_id AND month = _month), 'Receitas por categoria lançadas'),
    ('vendas', EXISTS (SELECT 1 FROM public.sales_data WHERE school_id = _school_id AND month = _month), 'Vendas lançadas'),
    ('contatos_matriculas', EXISTS (SELECT 1 FROM public.conversion_data WHERE school_id = _school_id AND month = _month), 'Contatos e matrículas lançados')
  ) AS x(step_key, ok, motivo) LOOP
    IF r.ok THEN
      UPDATE public.monthly_closing_checklist SET status = 'completed', source = 'automatic', completed_by = NULL, completed_at = now(),
        note = 'Marcado automaticamente: ' || r.motivo, updated_at = now()
      WHERE school_id = _school_id AND month = _month AND step_key = r.step_key AND status = 'open';
    ELSE
      UPDATE public.monthly_closing_checklist SET status = 'open', completed_at = NULL,
        note = CASE WHEN r.step_key = 'kpis' THEN r.motivo ELSE NULL END, updated_at = now()
      WHERE school_id = _school_id AND month = _month AND step_key = r.step_key
        AND ((status = 'completed' AND source = 'automatic' AND completed_by IS NULL) OR (status = 'open' AND r.step_key = 'kpis'));
    END IF;
  END LOOP;
  RETURN v_inserted;
END;
$fn$;

CREATE TRIGGER report_progress_realized_ins AFTER INSERT ON public.realized_entries REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION public.report_progress_stmt_trigger('bank');
CREATE TRIGGER report_progress_realized_upd AFTER UPDATE ON public.realized_entries REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION public.report_progress_stmt_trigger('bank');
CREATE TRIGGER report_progress_realized_del AFTER DELETE ON public.realized_entries REFERENCING OLD TABLE AS ot FOR EACH STATEMENT EXECUTE FUNCTION public.report_progress_stmt_trigger('bank');