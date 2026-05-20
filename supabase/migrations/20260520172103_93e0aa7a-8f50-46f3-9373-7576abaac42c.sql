
ALTER TABLE public.simulation_monthly_quantities
  ADD COLUMN IF NOT EXISTS valor_unitario numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parcelas integer NOT NULL DEFAULT 1;
