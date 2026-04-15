ALTER TABLE public.conversion_data
DROP CONSTRAINT IF EXISTS conversion_data_school_id_month_key;

ALTER TABLE public.conversion_data
ADD CONSTRAINT conversion_data_school_id_month_tipo_key UNIQUE (school_id, month, tipo);