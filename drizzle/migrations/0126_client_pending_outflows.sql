CREATE TABLE public.bank_tx_client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transaction_id uuid NOT NULL UNIQUE REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  categoria_texto text NOT NULL DEFAULT '',
  observacao text,
  user_id uuid,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_tx_client_notes TO authenticated;
GRANT ALL ON public.bank_tx_client_notes TO service_role;
ALTER TABLE public.bank_tx_client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe gerencia notas do cliente" ON public.bank_tx_client_notes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Empresa restrita só super admin" ON public.bank_tx_client_notes AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));

CREATE OR REPLACE FUNCTION public.client_pending_outflows_enabled(_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_has_school_access(auth.uid(), _school_id) AND public.can_see_school(_school_id)
    AND EXISTS (SELECT 1 FROM school_features WHERE school_id = _school_id AND feature_key = 'cliente_pendencias_saidas' AND enabled)
$$;

CREATE OR REPLACE FUNCTION public.client_pending_outflows(_school_id uuid)
RETURNS TABLE (id uuid, data text, descricao text, valor numeric, conta text, categoria_texto text, observacao text, note_updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.client_pending_outflows_enabled(_school_id) THEN RAISE EXCEPTION 'Sem acesso'; END IF;
  RETURN QUERY
  SELECT t.id, t.data, t.descricao, abs(t.valor), a.nome, n.categoria_texto, n.observacao, n.updated_at
  FROM bank_transactions t JOIN bank_accounts a ON a.id = t.account_id
  LEFT JOIN bank_tx_client_notes n ON n.bank_transaction_id = t.id
  WHERE t.school_id = _school_id AND t.tipo = 'saida' AND t.recon_status = 'pendente'
    AND NOT t.is_forecast AND NOT a.is_virtual AND t.movement_kind = 'normal'
  ORDER BY t.data DESC, t.created_at;
END $$;

CREATE OR REPLACE FUNCTION public.save_client_tx_note(_tx_id uuid, _texto text, _obs text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record;
BEGIN
  SELECT bt.*, a.is_virtual INTO t FROM bank_transactions bt JOIN bank_accounts a ON a.id = bt.account_id WHERE bt.id = _tx_id;
  IF NOT FOUND OR NOT public.client_pending_outflows_enabled(t.school_id) THEN RAISE EXCEPTION 'Sem acesso'; END IF;
  IF t.tipo <> 'saida' OR t.recon_status <> 'pendente' OR t.is_forecast OR t.is_virtual OR t.movement_kind <> 'normal' THEN
    RAISE EXCEPTION 'Esta saída já foi tratada pela equipe';
  END IF;
  INSERT INTO bank_tx_client_notes (bank_transaction_id, school_id, categoria_texto, observacao, user_id, user_email)
  VALUES (_tx_id, t.school_id, left(coalesce(trim(_texto),''),300), nullif(left(trim(coalesce(_obs,'')),1000),''), auth.uid(), (SELECT email FROM profiles WHERE user_id = auth.uid()))
  ON CONFLICT (bank_transaction_id) DO UPDATE SET categoria_texto = EXCLUDED.categoria_texto, observacao = EXCLUDED.observacao,
    user_id = EXCLUDED.user_id, user_email = EXCLUDED.user_email, updated_at = now();
END $$;

REVOKE ALL ON FUNCTION public.client_pending_outflows_enabled(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.client_pending_outflows(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_client_tx_note(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_pending_outflows_enabled(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_pending_outflows(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_client_tx_note(uuid, text, text) TO authenticated;