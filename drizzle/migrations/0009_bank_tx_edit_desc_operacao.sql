ALTER TABLE public.bank_transactions ADD COLUMN descricao_editada text;
ALTER TABLE public.bank_transactions DROP CONSTRAINT bank_transactions_movement_kind_chk;
ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_movement_kind_chk CHECK (movement_kind IN ('normal','auto_aplicacao','auto_resgate','operacao'));

CREATE OR REPLACE FUNCTION public.guard_bank_tx_immutable()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _email text := (SELECT email FROM public.profiles WHERE user_id = auth.uid());
BEGIN
  IF NEW.valor IS DISTINCT FROM OLD.valor OR NEW.data IS DISTINCT FROM OLD.data
     OR NEW.tipo IS DISTINCT FROM OLD.tipo OR NEW.account_id IS DISTINCT FROM OLD.account_id
     OR NEW.descricao IS DISTINCT FROM OLD.descricao OR NEW.school_id IS DISTINCT FROM OLD.school_id
     OR NEW.import_id IS DISTINCT FROM OLD.import_id OR NEW.dedup_hash IS DISTINCT FROM OLD.dedup_hash THEN
    RAISE EXCEPTION 'Movimentações bancárias importadas não podem ter valor, data, sentido, conta ou descrição original alterados.';
  END IF;
  IF NEW.descricao_editada IS NOT NULL AND btrim(NEW.descricao_editada) = '' THEN NEW.descricao_editada := NULL; END IF;
  IF NEW.recon_status IS DISTINCT FROM OLD.recon_status THEN
    NEW.recon_by := auth.uid();
    NEW.recon_by_email := _email;
    NEW.recon_at := CASE WHEN NEW.recon_status = 'pendente' THEN NULL ELSE now() END;
    IF NEW.recon_status = 'pendente' THEN NEW.recon_by := NULL; NEW.recon_by_email := NULL; END IF;
    INSERT INTO public.bank_reconciliation_history (school_id, transaction_id, old_status, new_status, note, changed_by, changed_by_email)
    VALUES (NEW.school_id, NEW.id, OLD.recon_status, NEW.recon_status, NEW.recon_note, auth.uid(), _email);
  ELSIF NEW.recon_note IS DISTINCT FROM OLD.recon_note THEN
    INSERT INTO public.bank_reconciliation_history (school_id, transaction_id, old_status, new_status, note, changed_by, changed_by_email)
    VALUES (NEW.school_id, NEW.id, NEW.recon_status, NEW.recon_status,
      'Observação: "' || COALESCE(OLD.recon_note,'') || '" → "' || COALESCE(NEW.recon_note,'') || '"', auth.uid(), _email);
  END IF;
  IF NEW.descricao_editada IS DISTINCT FROM OLD.descricao_editada THEN
    INSERT INTO public.bank_reconciliation_history (school_id, transaction_id, old_status, new_status, note, changed_by, changed_by_email)
    VALUES (NEW.school_id, NEW.id, NEW.recon_status, NEW.recon_status,
      'Descrição: "' || COALESCE(OLD.descricao_editada, OLD.descricao) || '" → "' || COALESCE(NEW.descricao_editada, NEW.descricao) || '"', auth.uid(), _email);
  END IF;
  IF NEW.movement_kind IS DISTINCT FROM OLD.movement_kind THEN
    INSERT INTO public.bank_reconciliation_history (school_id, transaction_id, old_status, new_status, note, changed_by, changed_by_email)
    VALUES (NEW.school_id, NEW.id, NEW.recon_status, NEW.recon_status,
      'Categoria: ' || OLD.movement_kind || ' → ' || NEW.movement_kind, auth.uid(), _email);
  END IF;
  RETURN NEW;
END; $function$;