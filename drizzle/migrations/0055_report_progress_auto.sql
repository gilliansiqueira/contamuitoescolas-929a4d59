-- Prazo: 5º dia útil do mês seguinte (segunda a sábado, sem domingos e feriados nacionais), como no prazo de salários.
CREATE OR REPLACE FUNCTION public.report_due_date(_month text)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE d date; n int := 0;
  hol date[] := ARRAY['2026-01-01','2026-04-03','2026-04-21','2026-05-01','2026-09-07','2026-10-12','2026-11-02','2026-11-15','2026-11-20','2026-12-25',
                      '2027-01-01','2027-03-26','2027-04-21','2027-05-01','2027-09-07','2027-10-12','2027-11-02','2027-11-15','2027-11-20','2027-12-25']::date[];
BEGIN
  IF _month !~ '^[0-9]{4}-[0-9]{2}$' THEN RETURN NULL; END IF;
  d := ((_month || '-01')::date + interval '1 month')::date - 1;
  WHILE n < 5 LOOP
    d := d + 1;
    IF extract(isodow FROM d) <> 7 AND NOT (d = ANY(hol)) THEN n := n + 1; END IF;
  END LOOP;
  RETURN d;
END; $$;
GRANT EXECUTE ON FUNCTION public.report_due_date(text) TO authenticated;

-- Núcleo sem checagem de usuário (chamado pela tela via ensure_monthly_checklist e pelos gatilhos).
CREATE OR REPLACE FUNCTION public._refresh_report_progress(_school_id uuid, _month text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  v_pagas := EXISTS (SELECT 1 FROM public.upload_records u WHERE u.school_id = _school_id AND u.uploaded_at >= v_start AND u.uploaded_at < v_due AND u.tipo IN ('centro_custos','realizado'));
  SELECT count(*) INTO v_kdef FROM public.kpi_definitions WHERE school_id = _school_id AND enabled;
  SELECT count(DISTINCT v.kpi_definition_id) INTO v_kval FROM public.kpi_values v JOIN public.kpi_definitions d ON d.id = v.kpi_definition_id AND d.enabled
    WHERE v.school_id = _school_id AND v.month = _month AND v.value IS NOT NULL;

  FOR r IN SELECT * FROM (VALUES
    ('proj_realizado', v_recon, 'Conciliação do mês em 100%'),
    ('desp_conciliacao', v_recon, 'Conciliação do mês em 100%'),
    ('proj_futuras', v_proj, 'Projeção atualizada por upload'),
    ('desp_contas_pagas', v_pagas, 'Contas pagas enviadas'),
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
      -- Só reabre o que o sistema marcou; decisões da equipe ficam intactas.
      UPDATE public.monthly_closing_checklist SET status = 'open', completed_at = NULL,
        note = CASE WHEN r.step_key = 'kpis' THEN r.motivo ELSE NULL END, updated_at = now()
      WHERE school_id = _school_id AND month = _month AND step_key = r.step_key
        AND ((status = 'completed' AND source = 'automatic' AND completed_by IS NULL) OR (status = 'open' AND r.step_key = 'kpis'));
    END IF;
  END LOOP;
  RETURN v_inserted;
END; $$;
REVOKE ALL ON FUNCTION public._refresh_report_progress(uuid, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_monthly_checklist(_school_id uuid, _month text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito à equipe autorizada.'; END IF;
  IF _month !~ '^[0-9]{4}-[0-9]{2}$' THEN RAISE EXCEPTION 'Período inválido.'; END IF;
  RETURN public._refresh_report_progress(_school_id, _month);
END; $$;

-- Gatilho por comando (não por linha): uma atualização por empresa/mês afetado, mesmo em importações grandes.
-- Só meses de relatório em aberto: o mês anterior e o atual.
CREATE OR REPLACE FUNCTION public.report_progress_stmt_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; kind text := TG_ARGV[0]; tbl text := CASE WHEN TG_OP = 'DELETE' THEN 'ot' ELSE 'nt' END;
  m_expr text; cur text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');
  prev text := to_char((now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month', 'YYYY-MM');
BEGIN
  IF kind = 'upload' THEN
    -- Upload vale para o relatório do mês anterior e do atual.
    FOR r IN EXECUTE format('SELECT DISTINCT school_id FROM %I WHERE school_id IS NOT NULL', tbl) LOOP
      PERFORM public._refresh_report_progress(r.school_id, prev);
      PERFORM public._refresh_report_progress(r.school_id, cur);
    END LOOP;
    RETURN NULL;
  END IF;
  m_expr := CASE kind WHEN 'bank' THEN 'substr(data, 1, 7)' ELSE 'month' END;
  FOR r IN EXECUTE format('SELECT DISTINCT school_id, %s AS m FROM %I WHERE school_id IS NOT NULL', m_expr, tbl) LOOP
    IF r.m IN (prev, cur) THEN PERFORM public._refresh_report_progress(r.school_id, r.m); END IF;
  END LOOP;
  RETURN NULL;
END; $$;

DO $$
DECLARE t text; k text; spec text[][] := ARRAY[
  ARRAY['kpi_values','month'], ARRAY['receivable_category_values','month'], ARRAY['sales_data','month'],
  ARRAY['conversion_data','month'], ARRAY['upload_records','upload'], ARRAY['bank_transactions','bank']];
  i int;
BEGIN
  FOR i IN 1 .. array_length(spec, 1) LOOP
    t := spec[i][1]; k := spec[i][2];
    EXECUTE format('DROP TRIGGER IF EXISTS report_progress_ins ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS report_progress_upd ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS report_progress_del ON public.%I', t);
    EXECUTE format('CREATE TRIGGER report_progress_ins AFTER INSERT ON public.%I REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION public.report_progress_stmt_trigger(%L)', t, k);
    EXECUTE format('CREATE TRIGGER report_progress_upd AFTER UPDATE ON public.%I REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION public.report_progress_stmt_trigger(%L)', t, k);
    EXECUTE format('CREATE TRIGGER report_progress_del AFTER DELETE ON public.%I REFERENCING OLD TABLE AS ot FOR EACH STATEMENT EXECUTE FUNCTION public.report_progress_stmt_trigger(%L)', t, k);
  END LOOP;
END $$;

COMMENT ON COLUMN public.school_management_settings.closing_due_day IS 'DEPRECATED: prazo agora vem de report_due_date (5º dia útil do mês seguinte)';