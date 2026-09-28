CREATE OR REPLACE FUNCTION public.sync_bank_cashflow_tx(_tx_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tx public.bank_transactions;
  _cfg public.school_data_sources;
  _floor text;
  _split_sum numeric;
  _n_splits int;
  _s record;
  _desc text;
BEGIN
  SELECT * INTO _tx FROM public.bank_transactions WHERE id = _tx_id;
  IF NOT FOUND THEN RETURN; END IF;
  DELETE FROM public.bank_cashflow_entries WHERE bank_transaction_id = _tx_id;

  SELECT * INTO _cfg FROM public.school_data_sources WHERE school_id = _tx.school_id AND status IN ('em_conferencia','ativo');
  IF NOT FOUND THEN RETURN; END IF;
  _floor := greatest(_cfg.start_month || '-01', '2026-09-01');
  IF _tx.data < _floor THEN RETURN; END IF;

  IF _tx.movement_kind IN ('auto_aplicacao','auto_resgate') THEN RETURN; END IF;
  IF _tx.transfer_pair_id IS NOT NULL THEN RETURN; END IF;

  _desc := coalesce(nullif(btrim(_tx.descricao_editada), ''), _tx.descricao);

  SELECT count(*), coalesce(sum(valor), 0) INTO _n_splits, _split_sum FROM public.bank_transaction_splits WHERE transaction_id = _tx_id;
  IF _n_splits > 0 THEN
    IF abs(round(_split_sum, 2) - round(_tx.valor, 2)) > 0.004 THEN RETURN; END IF;
    FOR _s IN SELECT sp.*, i.name AS item_name FROM public.bank_transaction_splits sp
              LEFT JOIN public.financial_model_template_items i ON i.id = sp.model_item_id
              WHERE sp.transaction_id = _tx_id LOOP
      INSERT INTO public.bank_cashflow_entries (school_id, bank_transaction_id, bank_split_id, account_id, data, descricao, valor, tipo, model_item_id, tipo_nome, recon_status)
      VALUES (_tx.school_id, _tx_id, _s.id, _tx.account_id, _tx.data, coalesce(nullif(btrim(_s.descricao), ''), _desc), round(_s.valor, 2), _tx.tipo, _s.model_item_id,
        CASE
          WHEN _s.categoria = 'ignorar' THEN 'Ignorar'
          WHEN _s.categoria = 'operacao' THEN 'Operação'
          ELSE coalesce(btrim(_s.item_name), 'A classificar')
        END, _tx.recon_status);
    END LOOP;
    RETURN;
  END IF;

  INSERT INTO public.bank_cashflow_entries (school_id, bank_transaction_id, account_id, data, descricao, valor, tipo, model_item_id, tipo_nome, recon_status)
  SELECT _tx.school_id, _tx_id, _tx.account_id, _tx.data, _desc, round(abs(_tx.valor), 2), _tx.tipo, _tx.model_item_id,
    CASE
      WHEN _tx.movement_kind = 'ignorar' THEN 'Ignorar'
      WHEN _tx.movement_kind = 'operacao' THEN 'Operação'
      ELSE coalesce(btrim(i.name), 'A classificar')
    END, _tx.recon_status
  FROM (SELECT 1) x LEFT JOIN public.financial_model_template_items i ON i.id = _tx.model_item_id;
END; $function$;