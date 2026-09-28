CREATE OR REPLACE FUNCTION public.apply_bank_default_model_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tipo text;
  _item_id uuid;
  _tx public.bank_transactions;
  _kind text;
BEGIN
  IF TG_TABLE_NAME = 'bank_transaction_splits' THEN
    SELECT * INTO _tx FROM public.bank_transactions WHERE id = NEW.transaction_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento bancário não encontrado.'; END IF;
    _tipo := _tx.tipo;
    NEW.school_id := _tx.school_id;
    _kind := NEW.categoria;
  ELSE
    _tipo := NEW.tipo;
    _kind := NEW.movement_kind;
  END IF;

  IF _kind = 'normal' THEN
    SELECT i.id INTO _item_id
    FROM public.financial_model_template_items i
    JOIN public.schools s ON s.financial_model_template_id = i.template_id
    WHERE s.id = NEW.school_id
      AND i.tipo = _tipo
      AND lower(btrim(i.name)) = ANY (CASE WHEN _tipo = 'entrada' THEN ARRAY['receita','receitas'] ELSE ARRAY['despesa','despesas'] END)
    ORDER BY i.sort_order, i.id
    LIMIT 1;
    IF _item_id IS NULL THEN RAISE EXCEPTION 'O modelo da empresa não possui o tipo padrão de Receita/Despesa.'; END IF;
    NEW.model_item_id := _item_id;
  ELSIF _kind IN ('ignorar','transferencia','auto_aplicacao','auto_resgate') THEN
    NEW.model_item_id := NULL;
  ELSIF _kind = 'operacao' AND NEW.model_item_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.financial_model_template_items i
    WHERE i.id = NEW.model_item_id AND lower(btrim(i.name)) IN ('receita','despesa','receitas','despesas')
  ) THEN
    NEW.model_item_id := NULL;
  END IF;
  RETURN NEW;
END;
$function$;