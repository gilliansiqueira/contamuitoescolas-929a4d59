CREATE TABLE public.simulation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  nome text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  parcelas integer NOT NULL DEFAULT 1,
  mes_inicio text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.simulation_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "se_select" ON public.simulation_entries FOR SELECT
USING (is_admin() OR user_has_school_access(auth.uid(), school_id));

CREATE POLICY "se_insert" ON public.simulation_entries FOR INSERT
WITH CHECK (is_admin() OR user_has_school_access(auth.uid(), school_id));

CREATE POLICY "se_update" ON public.simulation_entries FOR UPDATE
USING (is_admin() OR user_has_school_access(auth.uid(), school_id));

CREATE POLICY "se_delete" ON public.simulation_entries FOR DELETE
USING (is_admin() OR user_has_school_access(auth.uid(), school_id));

CREATE TRIGGER simulation_entries_touch_updated_at
BEFORE UPDATE ON public.simulation_entries
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_simulation_entries_school ON public.simulation_entries(school_id);