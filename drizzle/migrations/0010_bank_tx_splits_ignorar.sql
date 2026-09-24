ALTER TABLE public.bank_transactions DROP CONSTRAINT bank_transactions_movement_kind_chk;
ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_movement_kind_chk CHECK (movement_kind IN ('normal','auto_aplicacao','auto_resgate','operacao','ignorar'));

CREATE TABLE public.bank_transaction_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  valor numeric NOT NULL CHECK (valor > 0),
  categoria text NOT NULL DEFAULT 'normal' CHECK (categoria IN ('normal','operacao','ignorar')),
  descricao text,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bank_transaction_splits_tx_idx ON public.bank_transaction_splits(transaction_id);
CREATE INDEX bank_transaction_splits_school_idx ON public.bank_transaction_splits(school_id);
GRANT SELECT ON public.bank_transaction_splits TO authenticated;
GRANT ALL ON public.bank_transaction_splits TO service_role;
ALTER TABLE public.bank_transaction_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read splits" ON public.bank_transaction_splits FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.set_bank_tx_splits(_tx_id uuid, _parts jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tx public.bank_transactions; _sum numeric := 0; _p jsonb; _i int := 0; _email text; _desc text := '';
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Somente administradores podem dividir lançamentos.'; END IF;
  SELECT * INTO _tx FROM public.bank_transactions WHERE id = _tx_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento não encontrado.'; END IF;
  _email := (SELECT email FROM public.profiles WHERE user_id = auth.uid());
  DELETE FROM public.bank_transaction_splits WHERE transaction_id = _tx_id;
  IF _parts IS NULL OR jsonb_array_length(_parts) = 0 THEN
    INSERT INTO public.bank_reconciliation_history (school_id, transaction_id, old_status, new_status, note, changed_by, changed_by_email)
    VALUES (_tx.school_id, _tx_id, _tx.recon_status, _tx.recon_status, 'Divisão desfeita', auth.uid(), _email);
    RETURN;
  END IF;
  IF jsonb_array_length(_parts) < 2 THEN RAISE EXCEPTION 'A divisão precisa de pelo menos 2 partes.'; END IF;
  FOR _p IN SELECT * FROM jsonb_array_elements(_parts) LOOP
    _i := _i + 1;
    IF (_p->>'valor')::numeric <= 0 THEN RAISE EXCEPTION 'Cada parte precisa de valor maior que zero.'; END IF;
    _sum := _sum + round((_p->>'valor')::numeric, 2);
    INSERT INTO public.bank_transaction_splits (school_id, transaction_id, valor, categoria, descricao, note, sort_order, created_by)
    VALUES (_tx.school_id, _tx_id, round((_p->>'valor')::numeric, 2), COALESCE(NULLIF(_p->>'categoria',''),'normal'),
      NULLIF(btrim(_p->>'descricao'),''), NULLIF(btrim(_p->>'note'),''), _i, auth.uid());
    _desc := _desc || CASE WHEN _i > 1 THEN '; ' ELSE '' END || to_char(round((_p->>'valor')::numeric,2), 'FM999999990.00') || ' ' || COALESCE(NULLIF(_p->>'categoria',''),'normal');
  END LOOP;
  IF abs(_sum - round(_tx.valor, 2)) > 0.004 THEN
    RAISE EXCEPTION 'A soma das partes (%) precisa ser igual ao valor do banco (%).', _sum, _tx.valor;
  END IF;
  INSERT INTO public.bank_reconciliation_history (school_id, transaction_id, old_status, new_status, note, changed_by, changed_by_email)
  VALUES (_tx.school_id, _tx_id, _tx.recon_status, _tx.recon_status, 'Dividido em ' || _i || ' partes: ' || _desc, auth.uid(), _email);
END; $$;
REVOKE ALL ON FUNCTION public.set_bank_tx_splits(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_bank_tx_splits(uuid, jsonb) TO authenticated;