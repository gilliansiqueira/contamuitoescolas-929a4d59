CREATE OR REPLACE FUNCTION public.client_pending_outflows_enabled(_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_has_school_access(auth.uid(), _school_id) AND public.can_see_school(_school_id)
    AND EXISTS (SELECT 1 FROM school_features WHERE school_id = _school_id AND feature_key IN ('cliente_pendencias_saidas','cliente_pendencias_entradas') AND enabled)
$$;

CREATE OR REPLACE FUNCTION public.client_pending_types(_school_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.user_has_school_access(auth.uid(), _school_id) AND public.can_see_school(_school_id) THEN
    coalesce(array_agg(CASE feature_key WHEN 'cliente_pendencias_saidas' THEN 'saida' ELSE 'entrada' END), '{}')
  ELSE '{}' END
  FROM school_features WHERE school_id = _school_id AND feature_key IN ('cliente_pendencias_saidas','cliente_pendencias_entradas') AND enabled
$$;

DROP FUNCTION IF EXISTS public.client_pending_outflows(uuid);
CREATE FUNCTION public.client_pending_outflows(_school_id uuid)
RETURNS TABLE (id uuid, data text, descricao text, valor numeric, conta text, categoria_texto text, observacao text, note_updated_at timestamptz, tipo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _types text[] := public.client_pending_types(_school_id);
BEGIN
  IF NOT public.client_pending_outflows_enabled(_school_id) THEN RAISE EXCEPTION 'Sem acesso'; END IF;
  RETURN QUERY
  SELECT t.id, t.data, t.descricao, abs(t.valor), a.nome, n.categoria_texto, n.observacao, n.updated_at, t.tipo::text
  FROM bank_transactions t JOIN bank_accounts a ON a.id = t.account_id
  LEFT JOIN bank_tx_client_notes n ON n.bank_transaction_id = t.id
  WHERE t.school_id = _school_id AND t.tipo::text = ANY(_types) AND t.recon_status = 'pendente'
    AND NOT t.is_forecast AND NOT a.is_virtual AND t.movement_kind = 'normal'
  ORDER BY t.data DESC, t.created_at;
END $$;

CREATE OR REPLACE FUNCTION public.save_client_tx_note(_tx_id uuid, _texto text, _obs text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record;
BEGIN
  SELECT bt.*, a.is_virtual INTO t FROM bank_transactions bt JOIN bank_accounts a ON a.id = bt.account_id WHERE bt.id = _tx_id;
  IF NOT FOUND OR NOT public.client_pending_outflows_enabled(t.school_id) THEN RAISE EXCEPTION 'Sem acesso'; END IF;
  IF NOT (t.tipo::text = ANY(public.client_pending_types(t.school_id))) OR t.recon_status <> 'pendente' OR t.is_forecast OR t.is_virtual OR t.movement_kind <> 'normal' THEN
    RAISE EXCEPTION 'Este lançamento já foi tratado pela equipe';
  END IF;
  INSERT INTO bank_tx_client_notes (bank_transaction_id, school_id, categoria_texto, observacao, user_id, user_email)
  VALUES (_tx_id, t.school_id, left(coalesce(trim(_texto),''),300), nullif(left(trim(coalesce(_obs,'')),1000),''), auth.uid(), (SELECT email FROM profiles WHERE user_id = auth.uid()))
  ON CONFLICT (bank_transaction_id) DO UPDATE SET categoria_texto = EXCLUDED.categoria_texto, observacao = EXCLUDED.observacao,
    user_id = EXCLUDED.user_id, user_email = EXCLUDED.user_email, updated_at = now();
END $$;

REVOKE ALL ON FUNCTION public.client_pending_types(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.client_pending_outflows(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_pending_types(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_pending_outflows(uuid) TO authenticated;