CREATE TABLE public.school_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, feature_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_features TO authenticated;
GRANT ALL ON public.school_features TO service_role;
ALTER TABLE public.school_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage school features" ON public.school_features FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  nome text NOT NULL,
  banco text NOT NULL DEFAULT '',
  agencia text,
  conta text,
  saldo_inicial numeric NOT NULL DEFAULT 0,
  saldo_inicial_data text,
  ativa boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage bank accounts" ON public.bank_accounts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.bank_statement_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text,
  file_hash text NOT NULL,
  formato text NOT NULL,
  periodo_inicio text,
  periodo_fim text,
  total_linhas integer NOT NULL DEFAULT 0,
  inseridas integer NOT NULL DEFAULT 0,
  duplicadas integer NOT NULL DEFAULT 0,
  total_entradas numeric NOT NULL DEFAULT 0,
  total_saidas numeric NOT NULL DEFAULT 0,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, file_hash)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_statement_imports TO authenticated;
GRANT ALL ON public.bank_statement_imports TO service_role;
ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage bank imports" ON public.bank_statement_imports FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  import_id uuid NOT NULL REFERENCES public.bank_statement_imports(id) ON DELETE CASCADE,
  data text NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL CHECK (valor >= 0),
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  bank_ref text,
  dedup_hash text NOT NULL,
  transfer_pair_id uuid,
  recon_status text NOT NULL DEFAULT 'pendente' CHECK (recon_status IN ('pendente','conciliado','nao_se_aplica')),
  recon_by uuid,
  recon_by_email text,
  recon_at timestamptz,
  recon_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, dedup_hash)
);
CREATE INDEX idx_bank_tx_school_data ON public.bank_transactions (school_id, data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_transactions TO service_role;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage bank transactions" ON public.bank_transactions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.bank_reconciliation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  note text,
  changed_by uuid,
  changed_by_email text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.bank_reconciliation_history TO authenticated;
GRANT ALL ON public.bank_reconciliation_history TO service_role;
ALTER TABLE public.bank_reconciliation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read recon history" ON public.bank_reconciliation_history FOR SELECT TO authenticated
  USING (public.is_admin());

-- Conciliação/par de transferência nunca alteram valor, data, sentido, conta ou descrição
CREATE OR REPLACE FUNCTION public.guard_bank_tx_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_bank_tx_immutable BEFORE UPDATE ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_bank_tx_immutable();

-- Todo lançamento novo entra como Pendente
CREATE OR REPLACE FUNCTION public.bank_tx_force_pending()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.recon_status := 'pendente'; NEW.recon_by := NULL; NEW.recon_by_email := NULL; NEW.recon_at := NULL;
  RETURN NEW;
END; $$;
CREATE TRIGGER bank_tx_force_pending BEFORE INSERT ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.bank_tx_force_pending();