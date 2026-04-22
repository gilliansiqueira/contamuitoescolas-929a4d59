ALTER TABLE public.type_classifications
ADD COLUMN IF NOT EXISTS operacao_sinal text NOT NULL DEFAULT 'auto';

-- Constrain to allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'type_classifications_operacao_sinal_check'
  ) THEN
    ALTER TABLE public.type_classifications
    ADD CONSTRAINT type_classifications_operacao_sinal_check
    CHECK (operacao_sinal IN ('auto', 'somar', 'subtrair'));
  END IF;
END $$;