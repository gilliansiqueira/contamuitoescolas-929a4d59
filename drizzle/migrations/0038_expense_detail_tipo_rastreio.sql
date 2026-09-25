ALTER TABLE public.expense_detail_items
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'despesa',
  ADD COLUMN IF NOT EXISTS origem_upload_id uuid REFERENCES public.upload_records(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_file text,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_expense_detail_items_upload ON public.expense_detail_items(origem_upload_id);

CREATE OR REPLACE FUNCTION public.tg_expense_detail_items_validate_tipo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo NOT IN ('receita','despesa') THEN
    RAISE EXCEPTION 'tipo inválido: %', NEW.tipo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expense_detail_items_validate_tipo ON public.expense_detail_items;
CREATE TRIGGER expense_detail_items_validate_tipo
BEFORE INSERT OR UPDATE ON public.expense_detail_items
FOR EACH ROW EXECUTE FUNCTION public.tg_expense_detail_items_validate_tipo();