ALTER TABLE public.monthly_report_analyses ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'relatorio' CHECK (kind IN ('relatorio','projecao'));
ALTER TABLE public.monthly_report_analyses DROP CONSTRAINT IF EXISTS monthly_report_analyses_school_id_month_key;
ALTER TABLE public.monthly_report_analyses ADD CONSTRAINT monthly_report_analyses_school_month_kind_key UNIQUE (school_id, month, kind);