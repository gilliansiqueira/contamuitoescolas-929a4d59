CREATE OR REPLACE FUNCTION public.set_bank_split_model_item(_split_id uuid, _item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _sp public.bank_transaction_splits;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Somente administradores podem classificar.'; END IF;
  SELECT * INTO _sp FROM public.bank_transaction_splits WHERE id = _split_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parte não encontrada.'; END IF;
  UPDATE public.bank_transaction_splits SET model_item_id = _item_id WHERE id = _split_id;
  INSERT INTO public.bank_reconciliation_history (school_id, transaction_id, old_status, new_status, note, changed_by, changed_by_email)
  SELECT _sp.school_id, _sp.transaction_id, t.recon_status, t.recon_status,
    'Tipo financeiro da parte de ' || to_char(_sp.valor, 'FM999999990.00') || ': ' ||
    coalesce((SELECT name FROM public.financial_model_template_items WHERE id = _sp.model_item_id), 'A classificar') || ' → ' ||
    coalesce((SELECT name FROM public.financial_model_template_items WHERE id = _item_id), 'A classificar'),
    auth.uid(), (SELECT email FROM public.profiles WHERE user_id = auth.uid())
  FROM public.bank_transactions t WHERE t.id = _sp.transaction_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_bank_split_model_item(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_bank_split_model_item(uuid, uuid) TO authenticated;