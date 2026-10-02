CREATE OR REPLACE FUNCTION public.create_partner_cheque_pair(_school_id uuid, _data text, _valor numeric, _socio text, _nota text, _in_item uuid, _out_item uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _acc uuid; _pair uuid := gen_random_uuid(); _email text; _v numeric := round(_valor, 2); _desc text; _a uuid; _b uuid; _tpl uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores podem lançar.'; END IF;
  IF NOT public.user_has_school_access(auth.uid(), _school_id) THEN RAISE EXCEPTION 'Sem acesso à empresa.'; END IF;
  IF _v IS NULL OR _v <= 0 THEN RAISE EXCEPTION 'Informe um valor maior que zero.'; END IF;
  IF _data !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Data inválida.'; END IF;
  IF public.is_date_in_closed_month(_school_id, _data) THEN RAISE EXCEPTION 'O mês desta data está fechado.'; END IF;
  SELECT financial_model_template_id INTO _tpl FROM public.schools WHERE id = _school_id;
  IF NOT EXISTS (SELECT 1 FROM public.financial_model_template_items WHERE id = _in_item AND template_id = _tpl AND tipo = 'entrada')
     OR NOT EXISTS (SELECT 1 FROM public.financial_model_template_items WHERE id = _out_item AND template_id = _tpl AND tipo = 'saida') THEN
    RAISE EXCEPTION 'Escolha um item de entrada e um de saída do modelo da empresa.';
  END IF;
  SELECT id INTO _acc FROM public.bank_accounts WHERE school_id = _school_id AND is_virtual LIMIT 1;
  IF _acc IS NULL THEN
    INSERT INTO public.bank_accounts(school_id, nome, banco, saldo_inicial, ativa, is_virtual, sort_order)
    VALUES (_school_id, 'Fora do banco (sócios)', 'Virtual', 0, true, true, 999) RETURNING id INTO _acc;
  END IF;
  _desc := 'Cheques depositados pelos sócios' || coalesce(' - ' || nullif(btrim(_socio), ''), '');
  INSERT INTO public.bank_transactions(school_id, account_id, data, descricao, valor, tipo, dedup_hash, model_item_id, manual_pair_id, recon_note)
  VALUES (_school_id, _acc, _data, _desc, _v, 'entrada', 'manual:' || _pair || ':in', _in_item, _pair, nullif(btrim(_nota), '')) RETURNING id INTO _a;
  INSERT INTO public.bank_transactions(school_id, account_id, data, descricao, valor, tipo, dedup_hash, model_item_id, manual_pair_id, recon_note)
  VALUES (_school_id, _acc, _data, _desc, _v, 'saida', 'manual:' || _pair || ':out', _out_item, _pair, nullif(btrim(_nota), '')) RETURNING id INTO _b;
  UPDATE public.bank_transactions SET recon_status = 'conciliado' WHERE id IN (_a, _b);
  SELECT email INTO _email FROM public.profiles WHERE user_id = auth.uid();
  INSERT INTO public.audit_log(school_id, action, description)
  VALUES (_school_id, 'cheques_socios_lancado', format('Cheques depositados pelos sócios (%s) em %s: R$ %s entrada + R$ %s saída, efeito no caixa R$ 0,00. Por %s. %s',
    coalesce(nullif(btrim(_socio), ''), '-'), _data, _v, _v, coalesce(_email, auth.uid()::text), coalesce(_nota, '')));
  PERFORM public.sync_bank_cashflow_tx(_a);
  PERFORM public.sync_bank_cashflow_tx(_b);
  RETURN _pair;
END; $$;