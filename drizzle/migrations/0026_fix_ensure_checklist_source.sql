CREATE OR REPLACE FUNCTION public.ensure_monthly_checklist(_school_id uuid, _month text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step record;
  v_inserted integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à equipe autorizada.';
  END IF;
  IF _month !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'Período inválido.';
  END IF;

  FOR v_step IN
    SELECT t.step_key, COALESCE(o.label, t.label) AS label, t.sort_order
    FROM public.closing_step_templates t
    LEFT JOIN public.school_closing_step_overrides o
      ON o.school_id = _school_id AND o.template_id = t.id
    WHERE t.active AND COALESCE(o.disabled, false) = false
    UNION ALL
    SELECT o.step_key, o.label, 1000 + o.sort_order
    FROM public.school_closing_step_overrides o
    WHERE o.school_id = _school_id AND o.template_id IS NULL AND o.disabled = false AND o.label IS NOT NULL
  LOOP
    INSERT INTO public.monthly_closing_checklist (school_id, month, step_key, label, source, status)
    SELECT _school_id, _month, v_step.step_key, v_step.label, 'automatic', 'open'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.monthly_closing_checklist c
      WHERE c.school_id = _school_id AND c.month = _month AND c.step_key = v_step.step_key
    );
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;