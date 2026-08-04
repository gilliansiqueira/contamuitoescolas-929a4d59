CREATE TABLE public.simulation_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  descricao text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'entrada' CHECK (tipo IN ('entrada','saida')),
  month text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulation_adjustments TO authenticated;
GRANT ALL ON public.simulation_adjustments TO service_role;

ALTER TABLE public.simulation_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY sa_select ON public.simulation_adjustments FOR SELECT USING (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY sa_insert ON public.simulation_adjustments FOR INSERT WITH CHECK (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY sa_update ON public.simulation_adjustments FOR UPDATE USING (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY sa_delete ON public.simulation_adjustments FOR DELETE USING (is_admin() OR user_has_school_access(auth.uid(), school_id));

CREATE INDEX idx_sa_school ON public.simulation_adjustments(school_id);