-- Tabela de fechamento de períodos (mês) por escola
CREATE TABLE public.period_closures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- YYYY-MM
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by UUID,
  reopened_at TIMESTAMPTZ,
  reopened_by UUID,
  reopen_reason TEXT,
  status TEXT NOT NULL DEFAULT 'closed', -- 'closed' | 'reopened'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX period_closures_school_month_active_idx
  ON public.period_closures(school_id, month)
  WHERE status = 'closed';

CREATE INDEX period_closures_school_idx ON public.period_closures(school_id);

ALTER TABLE public.period_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY pc_select ON public.period_closures
  FOR SELECT USING (is_admin() OR user_has_school_access(auth.uid(), school_id));

CREATE POLICY pc_insert ON public.period_closures
  FOR INSERT WITH CHECK (is_admin() OR user_has_school_access(auth.uid(), school_id));

-- Apenas admin pode atualizar (reabrir)
CREATE POLICY pc_update_admin ON public.period_closures
  FOR UPDATE USING (is_admin());

-- Apenas admin pode deletar
CREATE POLICY pc_delete_admin ON public.period_closures
  FOR DELETE USING (is_admin());

-- Função helper: verifica se um mês está fechado
CREATE OR REPLACE FUNCTION public.is_month_closed(_school_id UUID, _month TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.period_closures
    WHERE school_id = _school_id
      AND month = _month
      AND status = 'closed'
  );
$$;

-- Função helper: verifica se uma data (YYYY-MM-DD) está em mês fechado
CREATE OR REPLACE FUNCTION public.is_date_in_closed_month(_school_id UUID, _date TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_month_closed(_school_id, substring(_date FROM 1 FOR 7));
$$;

-- Trigger para bloquear inserts/updates/deletes em realized_entries de meses fechados
CREATE OR REPLACE FUNCTION public.guard_realized_entries_closed_month()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_date TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_school_id := OLD.school_id;
    v_date := OLD.data;
  ELSE
    v_school_id := NEW.school_id;
    v_date := NEW.data;
  END IF;

  IF public.is_date_in_closed_month(v_school_id, v_date) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Mês % está fechado. Reabra o período antes de alterar lançamentos.', substring(v_date FROM 1 FOR 7);
  END IF;

  -- Para UPDATE: se a data mudou para outro mês também fechado, bloquear
  IF TG_OP = 'UPDATE' AND OLD.data IS DISTINCT FROM NEW.data THEN
    IF public.is_date_in_closed_month(NEW.school_id, OLD.data) AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Mês de origem % está fechado.', substring(OLD.data FROM 1 FOR 7);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_realized_entries_closed
BEFORE INSERT OR UPDATE OR DELETE ON public.realized_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_realized_entries_closed_month();

-- Trigger semelhante para monthly_revenue (faturamento)
CREATE OR REPLACE FUNCTION public.guard_monthly_revenue_closed_month()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_month TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_school_id := OLD.school_id;
    v_month := OLD.month;
  ELSE
    v_school_id := NEW.school_id;
    v_month := NEW.month;
  END IF;

  IF public.is_month_closed(v_school_id, v_month) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Mês % está fechado.', v_month;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_monthly_revenue_closed
BEFORE INSERT OR UPDATE OR DELETE ON public.monthly_revenue
FOR EACH ROW EXECUTE FUNCTION public.guard_monthly_revenue_closed_month();

-- Trigger para kpi_values
CREATE OR REPLACE FUNCTION public.guard_kpi_values_closed_month()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_month TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_school_id := OLD.school_id; v_month := OLD.month;
  ELSE
    v_school_id := NEW.school_id; v_month := NEW.month;
  END IF;
  IF public.is_month_closed(v_school_id, v_month) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Mês % está fechado.', v_month;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_kpi_values_closed
BEFORE INSERT OR UPDATE OR DELETE ON public.kpi_values
FOR EACH ROW EXECUTE FUNCTION public.guard_kpi_values_closed_month();

-- Trigger para receivable_category_values
CREATE OR REPLACE FUNCTION public.guard_receivable_values_closed_month()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_month TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_school_id := OLD.school_id; v_month := OLD.month;
  ELSE
    v_school_id := NEW.school_id; v_month := NEW.month;
  END IF;
  IF public.is_month_closed(v_school_id, v_month) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Mês % está fechado.', v_month;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_receivable_values_closed
BEFORE INSERT OR UPDATE OR DELETE ON public.receivable_category_values
FOR EACH ROW EXECUTE FUNCTION public.guard_receivable_values_closed_month();