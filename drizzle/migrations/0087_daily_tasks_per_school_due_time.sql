ALTER TABLE public.daily_task_templates ADD COLUMN IF NOT EXISTS school_ids uuid[];
ALTER TABLE public.daily_task_templates ADD COLUMN IF NOT EXISTS due_time time;
ALTER TABLE public.daily_task_templates ADD COLUMN IF NOT EXISTS weekdays_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.daily_task_checklist ADD COLUMN IF NOT EXISTS due_time time;

CREATE OR REPLACE FUNCTION public.ensure_daily_tasks(_school_id uuid, _day date)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_count integer; v_has boolean; v_pend integer; v_unjust integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à equipe autorizada.';
  END IF;
  INSERT INTO public.daily_task_checklist (school_id, day, task_key, label, sort_order, check_kind, due_time)
  SELECT _school_id, _day, t.task_key, t.label, t.sort_order, t.check_kind, t.due_time
  FROM public.daily_task_templates t
  WHERE t.active
    AND (t.school_ids IS NULL OR _school_id = ANY(t.school_ids))
    AND (NOT t.weekdays_only OR extract(isodow FROM _day) BETWEEN 1 AND 5)
  ON CONFLICT (school_id, day, task_key) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  v_has := EXISTS (SELECT 1 FROM public.bank_transactions b WHERE b.school_id = _school_id AND NOT b.is_forecast AND b.data <= _day::text);
  IF v_has THEN
    SELECT count(*), count(*) FILTER (WHERE b.justification_reason_id IS NULL)
      INTO v_pend, v_unjust
    FROM public.bank_transactions b
    WHERE b.school_id = _school_id AND NOT b.is_forecast AND b.data <= _day::text
      AND b.data >= '2026-09-01' AND b.recon_status = 'pendente';
    IF v_pend = 0 THEN
      UPDATE public.daily_task_checklist SET status = 'completed', source = 'auto', completed_at = now(), updated_at = now()
      WHERE school_id = _school_id AND day = _day AND task_key = 'conciliacao' AND status IN ('open', 'done_with_pending');
    ELSIF v_unjust = 0 THEN
      UPDATE public.daily_task_checklist SET status = 'done_with_pending', source = 'auto', completed_at = now(), updated_at = now()
      WHERE school_id = _school_id AND day = _day AND task_key = 'conciliacao' AND status = 'open';
    END IF;
  END IF;
  RETURN v_count;
END;
$function$;