
-- 1) Adicionar coluna module
ALTER TABLE public.period_closures
  ADD COLUMN IF NOT EXISTS module text NOT NULL DEFAULT 'realizado';

ALTER TABLE public.period_closures
  ADD CONSTRAINT period_closures_module_chk
  CHECK (module IN ('realizado', 'projecao'));

-- Drop unique constraint antigo (se existir) e recriar com module
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'period_closures_school_month_key'
  ) THEN
    ALTER TABLE public.period_closures DROP CONSTRAINT period_closures_school_month_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS period_closures_school_month_module_uidx
  ON public.period_closures (school_id, month, module)
  WHERE status = 'closed';

-- 2) Função: verifica se um mês está fechado para um módulo específico
CREATE OR REPLACE FUNCTION public.is_month_closed_for_module(_school_id uuid, _month text, _module text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.period_closures
    WHERE school_id = _school_id
      AND month = _month
      AND module = _module
      AND status = 'closed'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_date_in_closed_month_for_module(_school_id uuid, _date text, _module text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_month_closed_for_module(_school_id, substring(_date FROM 1 FOR 7), _module);
$$;

-- 3) Atualizar funções existentes para considerar module='realizado'
CREATE OR REPLACE FUNCTION public.guard_realized_entries_closed_month()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_date text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_school_id := OLD.school_id; v_date := OLD.data;
  ELSE v_school_id := NEW.school_id; v_date := NEW.data;
  END IF;
  IF public.is_date_in_closed_month_for_module(v_school_id, v_date, 'realizado') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Mês % está fechado no Realizado.', substring(v_date FROM 1 FOR 7);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.data IS DISTINCT FROM NEW.data THEN
    IF public.is_date_in_closed_month_for_module(NEW.school_id, OLD.data, 'realizado') AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Mês de origem % está fechado no Realizado.', substring(OLD.data FROM 1 FOR 7);
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.guard_monthly_revenue_closed_month()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_month text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_school_id := OLD.school_id; v_month := OLD.month;
  ELSE v_school_id := NEW.school_id; v_month := NEW.month; END IF;
  IF public.is_month_closed_for_module(v_school_id, v_month, 'realizado') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Mês % está fechado no Realizado.', v_month;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.guard_kpi_values_closed_month()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_month text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_school_id := OLD.school_id; v_month := OLD.month;
  ELSE v_school_id := NEW.school_id; v_month := NEW.month; END IF;
  IF public.is_month_closed_for_module(v_school_id, v_month, 'realizado') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Mês % está fechado no Realizado.', v_month;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.guard_receivable_values_closed_month()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_month text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_school_id := OLD.school_id; v_month := OLD.month;
  ELSE v_school_id := NEW.school_id; v_month := NEW.month; END IF;
  IF public.is_month_closed_for_module(v_school_id, v_month, 'realizado') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Mês % está fechado no Realizado.', v_month;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

-- Garantir triggers do realizado existam
DROP TRIGGER IF EXISTS guard_realized_entries_closed ON public.realized_entries;
CREATE TRIGGER guard_realized_entries_closed
BEFORE INSERT OR UPDATE OR DELETE ON public.realized_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_realized_entries_closed_month();

DROP TRIGGER IF EXISTS guard_monthly_revenue_closed ON public.monthly_revenue;
CREATE TRIGGER guard_monthly_revenue_closed
BEFORE INSERT OR UPDATE OR DELETE ON public.monthly_revenue
FOR EACH ROW EXECUTE FUNCTION public.guard_monthly_revenue_closed_month();

DROP TRIGGER IF EXISTS guard_kpi_values_closed ON public.kpi_values;
CREATE TRIGGER guard_kpi_values_closed
BEFORE INSERT OR UPDATE OR DELETE ON public.kpi_values
FOR EACH ROW EXECUTE FUNCTION public.guard_kpi_values_closed_month();

DROP TRIGGER IF EXISTS guard_receivable_values_closed ON public.receivable_category_values;
CREATE TRIGGER guard_receivable_values_closed
BEFORE INSERT OR UPDATE OR DELETE ON public.receivable_category_values
FOR EACH ROW EXECUTE FUNCTION public.guard_receivable_values_closed_month();

-- 4) Triggers PROJEÇÃO
-- historical_monthly
CREATE OR REPLACE FUNCTION public.guard_historical_monthly_closed_proj()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_month text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_school_id := OLD.school_id; v_month := OLD.month;
  ELSE v_school_id := NEW.school_id; v_month := NEW.month; END IF;
  IF public.is_month_closed_for_module(v_school_id, v_month, 'projecao') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Mês % está fechado na Projeção. Reabra antes de alterar.', v_month;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_historical_monthly_closed ON public.historical_monthly;
CREATE TRIGGER guard_historical_monthly_closed
BEFORE INSERT OR UPDATE OR DELETE ON public.historical_monthly
FOR EACH ROW EXECUTE FUNCTION public.guard_historical_monthly_closed_proj();

-- financial_entries
CREATE OR REPLACE FUNCTION public.guard_financial_entries_closed_proj()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_date text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_school_id := OLD.school_id; v_date := OLD.data;
  ELSE v_school_id := NEW.school_id; v_date := NEW.data; END IF;
  IF public.is_date_in_closed_month_for_module(v_school_id, v_date, 'projecao') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Mês % está fechado na Projeção.', substring(v_date FROM 1 FOR 7);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.data IS DISTINCT FROM NEW.data THEN
    IF public.is_date_in_closed_month_for_module(NEW.school_id, OLD.data, 'projecao') AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Mês de origem % está fechado na Projeção.', substring(OLD.data FROM 1 FOR 7);
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_financial_entries_closed ON public.financial_entries;
CREATE TRIGGER guard_financial_entries_closed
BEFORE INSERT OR UPDATE OR DELETE ON public.financial_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_financial_entries_closed_proj();

-- sales_data
CREATE OR REPLACE FUNCTION public.guard_sales_data_closed_proj()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_month text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_school_id := OLD.school_id; v_month := OLD.month;
  ELSE v_school_id := NEW.school_id; v_month := NEW.month; END IF;
  IF public.is_month_closed_for_module(v_school_id, v_month, 'projecao') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Mês % está fechado na Projeção.', v_month;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_sales_data_closed ON public.sales_data;
CREATE TRIGGER guard_sales_data_closed
BEFORE INSERT OR UPDATE OR DELETE ON public.sales_data
FOR EACH ROW EXECUTE FUNCTION public.guard_sales_data_closed_proj();

-- conversion_data
CREATE OR REPLACE FUNCTION public.guard_conversion_data_closed_proj()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_month text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_school_id := OLD.school_id; v_month := OLD.month;
  ELSE v_school_id := NEW.school_id; v_month := NEW.month; END IF;
  IF public.is_month_closed_for_module(v_school_id, v_month, 'projecao') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Mês % está fechado na Projeção.', v_month;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_conversion_data_closed ON public.conversion_data;
CREATE TRIGGER guard_conversion_data_closed
BEFORE INSERT OR UPDATE OR DELETE ON public.conversion_data
FOR EACH ROW EXECUTE FUNCTION public.guard_conversion_data_closed_proj();
