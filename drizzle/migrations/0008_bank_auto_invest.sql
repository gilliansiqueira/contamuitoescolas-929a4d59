ALTER TABLE public.bank_accounts
  ADD COLUMN has_auto_invest boolean NOT NULL DEFAULT false,
  ADD COLUMN auto_invest_saldo_inicial numeric NOT NULL DEFAULT 0,
  ADD COLUMN auto_invest_saldo_data text;

ALTER TABLE public.bank_transactions
  ADD COLUMN movement_kind text NOT NULL DEFAULT 'normal';
ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_movement_kind_chk CHECK (movement_kind IN ('normal','auto_aplicacao','auto_resgate'));

ALTER TABLE public.bank_statement_imports
  ADD COLUMN saldo_final_informado numeric,
  ADD COLUMN saldo_aplicado_informado numeric;

CREATE TABLE public.bank_auto_invest_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  padrao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, padrao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_auto_invest_patterns TO authenticated;
GRANT ALL ON public.bank_auto_invest_patterns TO service_role;
ALTER TABLE public.bank_auto_invest_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage auto invest patterns" ON public.bank_auto_invest_patterns
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.guard_bank_tx_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.valor IS DISTINCT FROM OLD.valor OR NEW.data IS DISTINCT FROM OLD.data
     OR NEW.tipo IS DISTINCT FROM OLD.tipo OR NEW.account_id IS DISTINCT FROM OLD.account_id
     OR NEW.descricao IS DISTINCT FROM OLD.descricao OR NEW.school_id IS DISTINCT FROM OLD.school_id
     OR NEW.import_id IS DISTINCT FROM OLD.import_id OR NEW.dedup_hash IS DISTINCT FROM OLD.dedup_hash THEN
    RAISE EXCEPTION 'Movimentações bancárias importadas não podem ter valor, data, sentido, conta ou descrição alterados.';
  END IF;
  IF NEW.recon_status IS DISTINCT FROM OLD.recon_status OR NEW.recon_note IS DISTINCT FROM OLD.recon_note THEN
    NEW.recon_by := auth.uid();
    NEW.recon_by_email := (SELECT email FROM public.profiles WHERE user_id = auth.uid());
    NEW.recon_at := CASE WHEN NEW.recon_status = 'pendente' THEN NULL ELSE now() END;
    IF NEW.recon_status = 'pendente' THEN NEW.recon_by := NULL; NEW.recon_by_email := NULL; END IF;
    INSERT INTO public.bank_reconciliation_history (school_id, transaction_id, old_status, new_status, note, changed_by, changed_by_email)
    VALUES (NEW.school_id, NEW.id, OLD.recon_status, NEW.recon_status, NEW.recon_note, auth.uid(),
      (SELECT email FROM public.profiles WHERE user_id = auth.uid()));
  END IF;
  IF NEW.movement_kind IS DISTINCT FROM OLD.movement_kind THEN
    INSERT INTO public.bank_reconciliation_history (school_id, transaction_id, old_status, new_status, note, changed_by, changed_by_email)
    VALUES (NEW.school_id, NEW.id, NEW.recon_status, NEW.recon_status,
      'Tipo de movimento: ' || OLD.movement_kind || ' → ' || NEW.movement_kind, auth.uid(),
      (SELECT email FROM public.profiles WHERE user_id = auth.uid()));
  END IF;
  RETURN NEW;
END; $function$;