ALTER TABLE public.financial_entries 
ADD COLUMN IF NOT EXISTS tipo_registro text NOT NULL DEFAULT 'realizado',
ADD COLUMN IF NOT EXISTS editado_manualmente boolean NOT NULL DEFAULT false;