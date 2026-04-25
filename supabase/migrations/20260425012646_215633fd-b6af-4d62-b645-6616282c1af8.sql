-- Snapshot table: stores frozen totals when a month is closed
CREATE TABLE public.period_closure_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month text NOT NULL,
  module text NOT NULL DEFAULT 'projecao',
  closure_id uuid REFERENCES public.period_closures(id) ON DELETE SET NULL,

  -- Aggregated totals
  receitas numeric NOT NULL DEFAULT 0,
  despesas numeric NOT NULL DEFAULT 0,
  resultado numeric NOT NULL DEFAULT 0,
  operacoes_in numeric NOT NULL DEFAULT 0,
  operacoes_out numeric NOT NULL DEFAULT 0,
  saldo_movimento numeric NOT NULL DEFAULT 0,
  saldo_inicial numeric NOT NULL DEFAULT 0,
  saldo_final numeric NOT NULL DEFAULT 0,

  -- Per-type breakdown: [{ tipo, label, classificacao, sinal, valor }]
  por_tipo jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX period_closure_snapshots_unique
  ON public.period_closure_snapshots (school_id, month, module);

CREATE INDEX period_closure_snapshots_school_module_idx
  ON public.period_closure_snapshots (school_id, module);

ALTER TABLE public.period_closure_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY pcs_select ON public.period_closure_snapshots
  FOR SELECT USING (is_admin() OR user_has_school_access(auth.uid(), school_id));

CREATE POLICY pcs_insert ON public.period_closure_snapshots
  FOR INSERT WITH CHECK (is_admin() OR user_has_school_access(auth.uid(), school_id));

CREATE POLICY pcs_update_admin ON public.period_closure_snapshots
  FOR UPDATE USING (is_admin());

CREATE POLICY pcs_delete_admin ON public.period_closure_snapshots
  FOR DELETE USING (is_admin());