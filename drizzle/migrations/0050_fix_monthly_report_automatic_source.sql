CREATE OR REPLACE FUNCTION public.ensure_monthly_checklist(_school_id uuid, _month text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Automatic checks only complete still-open steps; manual decisions are preserved.
  v_ok := EXISTS (SELECT 1 FROM public.bank_transactions b WHERE b.school_id = _school_id AND b.data >= v_start::text AND b.data < v_end::text AND NOT b.is_forecast)
      AND NOT EXISTS (SELECT 1 FROM public.bank_transactions b WHERE b.school_id = _school_id AND b.data >= v_start::text AND b.data < v_end::text AND NOT b.is_forecast AND b.recon_status = 'pendente');
  IF v_ok THEN
    UPDATE public.monthly_closing_checklist SET status = 'completed', source = 'automatic', completed_at = now(), note = 'Conferido automaticamente pelo Fluxo Bancário', updated_at = now()
    WHERE school_id = _school_id AND month = _month AND status = 'open' AND step_key IN ('proj_realizado', 'desp_conciliacao');
  END IF;

  IF EXISTS (SELECT 1 FROM public.upload_records u WHERE u.school_id = _school_id AND u.uploaded_at >= v_start AND u.tipo IN ('sponte', 'contas_pagar', 'cheque', 'cartao')) THEN
    UPDATE public.monthly_closing_checklist SET status = 'completed', source = 'automatic', completed_at = now(), note = 'Projeção atualizada por upload', updated_at = now()
    WHERE school_id = _school_id AND month = _month AND status = 'open' AND step_key = 'proj_futuras';
  END IF;

  IF EXISTS (SELECT 1 FROM public.upload_records u WHERE u.school_id = _school_id AND u.uploaded_at >= v_start AND u.tipo IN ('centro_custos', 'realizado')) THEN
    UPDATE public.monthly_closing_checklist SET status = 'completed', source = 'automatic', completed_at = now(), note = 'Contas pagas enviadas', updated_at = now()
    WHERE school_id = _school_id AND month = _month AND status = 'open' AND step_key = 'desp_contas_pagas';
  END IF;

  RETURN v_inserted;
END;
$function$;