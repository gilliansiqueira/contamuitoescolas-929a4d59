CREATE INDEX IF NOT EXISTS idx_financial_entries_school_id_id ON public.financial_entries (school_id, id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_school ON public.chart_of_accounts (school_id);
CREATE INDEX IF NOT EXISTS idx_historical_monthly_school_id ON public.historical_monthly (school_id, id);
CREATE INDEX IF NOT EXISTS idx_kpi_values_school ON public.kpi_values (school_id);
DROP INDEX IF EXISTS public.idx_fe_origem_upload_id;