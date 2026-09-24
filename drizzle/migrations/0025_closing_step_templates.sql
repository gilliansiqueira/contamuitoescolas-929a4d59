CREATE TABLE public.closing_step_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_key text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.closing_step_templates TO authenticated;
GRANT ALL ON public.closing_step_templates TO service_role;
ALTER TABLE public.closing_step_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe lê etapas padrão" ON public.closing_step_templates FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Proprietária gerencia etapas padrão" ON public.closing_step_templates FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.school_closing_step_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.closing_step_templates(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  label text,
  disabled boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, step_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_closing_step_overrides TO authenticated;
GRANT ALL ON public.school_closing_step_overrides TO service_role;
ALTER TABLE public.school_closing_step_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe lê ajustes de etapas" ON public.school_closing_step_overrides FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Equipe gerencia ajustes de etapas" ON public.school_closing_step_overrides FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER touch_closing_step_templates BEFORE UPDATE ON public.closing_step_templates FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_school_closing_step_overrides BEFORE UPDATE ON public.school_closing_step_overrides FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

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
    SELECT _school_id, _month, v_step.step_key, v_step.label, 'template', 'open'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.monthly_closing_checklist c
      WHERE c.school_id = _school_id AND c.month = _month AND c.step_key = v_step.step_key
    );
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;