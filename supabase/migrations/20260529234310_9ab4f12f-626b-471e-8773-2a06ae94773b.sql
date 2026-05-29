-- 1. Limpar duplicatas: remover linhas malformadas em historical_monthly
--    quando já existe uma linha canônica com mesmo (school_id, tipo_valor, mês corrigido)
DELETE FROM public.historical_monthly h
WHERE h.month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  AND EXISTS (
    SELECT 1
    FROM public.historical_monthly h2
    WHERE h2.school_id = h.school_id
      AND h2.tipo_valor = h.tipo_valor
      AND h2.month = substring(h.month from 1 for 4) || '-' ||
                     lpad(substring(split_part(h.month, '-', 1) from 5), 2, '0')
  );

-- 2. Renomear linhas malformadas remanescentes para o formato canônico YYYY-MM
UPDATE public.historical_monthly
SET month = substring(month from 1 for 4) || '-' ||
            lpad(substring(split_part(month, '-', 1) from 5), 2, '0')
WHERE month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$';

-- 3. Constraints para impedir formatos inválidos em todas as tabelas com coluna `month`
ALTER TABLE public.historical_monthly
  ADD CONSTRAINT historical_monthly_month_format
  CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE public.monthly_revenue
  ADD CONSTRAINT monthly_revenue_month_format
  CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE public.conversion_data
  ADD CONSTRAINT conversion_data_month_format
  CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE public.kpi_values
  ADD CONSTRAINT kpi_values_month_format
  CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE public.receivable_category_values
  ADD CONSTRAINT receivable_category_values_month_format
  CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE public.investment_entries
  ADD CONSTRAINT investment_entries_month_format
  CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE public.period_closures
  ADD CONSTRAINT period_closures_month_format
  CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE public.period_closure_snapshots
  ADD CONSTRAINT period_closure_snapshots_month_format
  CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');