CREATE OR REPLACE FUNCTION public.delete_bank_tx(_tx_id uuid, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; _email text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores podem excluir lançamentos.'; END IF;
  IF _motivo IS NULL OR btrim(_motivo) = '' THEN RAISE EXCEPTION 'Informe o motivo da exclusão.'; END IF;
  SELECT * INTO t FROM public.bank_transactions WHERE id = _tx_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento não encontrado.'; END IF;
  IF t.recon_status = 'conciliado' THEN RAISE EXCEPTION 'Lançamento conciliado não pode ser excluído. Volte para pendente antes.'; END IF;
  IF public.is_date_in_closed_month(t.school_id, t.data) THEN RAISE EXCEPTION 'O mês deste lançamento está fechado.'; END IF;
  SELECT email INTO _email FROM public.profiles WHERE user_id = auth.uid();
  INSERT INTO public.audit_log(school_id, action, description)
  VALUES (t.school_id, 'bank_tx_excluida', format('Excluído por %s: %s %s R$ %s "%s" (conta %s, import %s). Motivo: %s',
    coalesce(_email, auth.uid()::text), t.data, t.tipo, t.valor, t.descricao, t.account_id, t.import_id, btrim(_motivo)));
  DELETE FROM public.bank_transactions WHERE id = _tx_id;
END; $$;
REVOKE ALL ON FUNCTION public.delete_bank_tx(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_bank_tx(uuid, text) TO authenticated;