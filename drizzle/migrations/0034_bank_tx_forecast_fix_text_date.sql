CREATE OR REPLACE FUNCTION public.bank_tx_replace_forecast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _f record;
BEGIN
  IF NEW.is_forecast THEN RETURN NEW; END IF;
  SELECT id, data, descricao INTO _f FROM public.bank_transactions
   WHERE account_id = NEW.account_id AND is_forecast AND tipo = NEW.tipo AND valor = NEW.valor
     AND NEW.data::date BETWEEN data::date AND data::date + 3
   ORDER BY data, created_at LIMIT 1;
  IF _f.id IS NULL THEN RETURN NEW; END IF;
  DELETE FROM public.bank_transactions WHERE id = _f.id;
  INSERT INTO public.bank_reconciliation_history (school_id, transaction_id, old_status, new_status, note, changed_by, changed_by_email)
  VALUES (NEW.school_id, NEW.id, NEW.recon_status, NEW.recon_status,
    'Substituiu lançamento futuro previsto de ' || to_char(_f.data::date,'DD/MM/YYYY') || ' (' || _f.descricao || ')', NULL, 'sistema');
  RETURN NEW;
END; $$;