CREATE OR REPLACE FUNCTION public.apply_bank_default_model_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tipo text;
  _item_id uuid;
  _tx public.bank_transactions;
BEGIN
  IF TG_TABLE_NAME = 'bank_transaction_splits' THEN
    SELECT * INTO _tx FROM public.bank_transactions WHERE id = NEW.transaction_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento bancário não encontrado.'; END IF;
    _tipo := _tx.tipo;
    NEW.school_id := _tx.school_id;

    IF NEW.categoria = 'normal' THEN
      SELECT i.id INTO _item_id
      FROM public.financial_model_template_items i
      JOIN public.schools s ON s.financial_model_template_id = i.template_id
      WHERE s.id = NEW.school_id
        AND i.tipo = _tipo
        AND lower(btrim(i.name)) = CASE WHEN _tipo = 'entrada' THEN 'receita' ELSE 'despesa' END
      ORDER BY i.sort_order, i.id
      LIMIT 1;
      IF _item_id IS NULL THEN RAISE EXCEPTION 'O modelo da empresa não possui o tipo padrão de Receita/Despesa.'; END IF;
      NEW.model_item_id := _item_id;
    ELSIF NEW.categoria = 'ignorar' THEN
      NEW.model_item_id := NULL;
    ELSIF NEW.categoria = 'operacao' AND NEW.model_item_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.financial_model_template_items i
      WHERE i.id = NEW.model_item_id AND lower(btrim(i.name)) IN ('receita','despesa')
    ) THEN
      NEW.model_item_id := NULL;
    END IF;
  ELSE
    _tipo := NEW.tipo;
    IF NEW.movement_kind = 'normal' THEN
      SELECT i.id INTO _item_id
      FROM public.financial_model_template_items i
      JOIN public.schools s ON s.financial_model_template_id = i.template_id
      WHERE s.id = NEW.school_id
        AND i.tipo = _tipo
        AND lower(btrim(i.name)) = CASE WHEN _tipo = 'entrada' THEN 'receita' ELSE 'despesa' END
      ORDER BY i.sort_order, i.id
      LIMIT 1;
      IF _item_id IS NULL THEN RAISE EXCEPTION 'O modelo da empresa não possui o tipo padrão de Receita/Despesa.'; END IF;
      NEW.model_item_id := _item_id;
    ELSIF NEW.movement_kind IN ('ignorar','transferencia','auto_aplicacao','auto_resgate') THEN
      NEW.model_item_id := NULL;
    ELSIF NEW.movement_kind = 'operacao' AND NEW.model_item_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.financial_model_template_items i
      WHERE i.id = NEW.model_item_id AND lower(btrim(i.name)) IN ('receita','despesa')
    ) THEN
      NEW.model_item_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bank_tx_apply_default_model_item
BEFORE INSERT OR UPDATE OF movement_kind, tipo, model_item_id ON public.bank_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_bank_default_model_item();

CREATE TRIGGER bank_split_apply_default_model_item
BEFORE INSERT OR UPDATE OF categoria, model_item_id ON public.bank_transaction_splits
FOR EACH ROW EXECUTE FUNCTION public.apply_bank_default_model_item();

CREATE OR REPLACE FUNCTION public.validate_bank_model_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _expected_tipo text;
BEGIN
  IF TG_TABLE_NAME = 'bank_transaction_splits' THEN
    SELECT tipo INTO _expected_tipo FROM public.bank_transactions WHERE id = NEW.transaction_id;
  ELSE
    _expected_tipo := NEW.tipo;
  END IF;

  IF NEW.model_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.financial_model_template_items i
    JOIN public.schools s ON s.financial_model_template_id = i.template_id
    WHERE i.id = NEW.model_item_id
      AND s.id = NEW.school_id
      AND i.tipo = _expected_tipo
  ) THEN
    RAISE EXCEPTION 'Tipo financeiro não pertence ao modelo desta empresa ou tem sentido incompatível com o lançamento.';
  END IF;
  RETURN NEW;
END; $$;