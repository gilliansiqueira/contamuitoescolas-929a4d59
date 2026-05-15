-- Permitir múltiplos investimentos por mês (cards configuráveis)
ALTER TABLE public.investment_entries
  DROP CONSTRAINT IF EXISTS investment_entries_school_id_month_key;

ALTER TABLE public.investment_entries
  ADD COLUMN IF NOT EXISTS nome TEXT NOT NULL DEFAULT 'Investimento',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;