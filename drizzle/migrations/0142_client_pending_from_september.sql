CREATE OR REPLACE FUNCTION public.client_pending_outflows(_school_id uuid)
 RETURNS TABLE(id uuid, data text, descricao text, valor numeric, conta text, categoria_texto text, observacao text, note_updated_at timestamp with time zone, tipo text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _types text[] := public.client_pending_types(_school_id);
        _start text := (SELECT ds.start_month FROM school_data_sources ds WHERE ds.school_id = _school_id LIMIT 1);
BEGIN
  IF NOT public.client_pending_outflows_enabled(_school_id) THEN RAISE EXCEPTION 'Sem acesso'; END IF;
  RETURN QUERY
  SELECT t.id, t.data, t.descricao, abs(t.valor), a.nome, n.categoria_texto, n.observacao, n.updated_at, t.tipo::text
  FROM bank_transactions t JOIN bank_accounts a ON a.id = t.account_id
  LEFT JOIN bank_tx_client_notes n ON n.bank_transaction_id = t.id
  WHERE t.school_id = _school_id AND t.tipo::text = ANY(_types) AND t.recon_status = 'pendente'
    AND NOT t.is_forecast AND NOT a.is_virtual AND t.movement_kind = 'normal'
    AND t.data >= '2026-09-01'
    AND (_start IS NULL OR left(t.data, 7) >= left(_start, 7))
  ORDER BY t.data DESC, t.created_at;
END $function$;