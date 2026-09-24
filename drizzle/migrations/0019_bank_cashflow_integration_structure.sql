-- 1. Configuração de fonte de dados por escola
CREATE TABLE public.school_data_sources (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','em_conferencia','ativo','pausado')),
  dashboard_source text NOT NULL DEFAULT 'planilha' CHECK (dashboard_source IN ('planilha','fluxo_caixa')),
  daily_flow_source text NOT NULL DEFAULT 'planilha' CHECK (daily_flow_source IN ('planilha','fluxo_caixa')),
  start_month text NOT NULL CHECK (start_month ~ '^[0-9]{4}-[0-9]{2}$' AND start_month >= '2026-09'),
  synced_through text,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_data_sources TO authenticated;
GRANT ALL ON public.school_data_sources TO service_role;
ALTER TABLE public.school_data_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY sds_select ON public.school_data_sources FOR SELECT TO authenticated
  USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY sds_insert ON public.school_data_sources FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY sds_update ON public.school_data_sources FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY sds_delete ON public.school_data_sources FOR DELETE TO authenticated USING (public.is_super_admin());
CREATE TRIGGER touch_school_data_sources BEFORE UPDATE ON public.school_data_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Saldos históricos por conta e data
CREATE TABLE public.bank_account_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  data text NOT NULL CHECK (data ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  saldo_conta numeric NOT NULL DEFAULT 0,
  saldo_aplicado numeric NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT 'cadastro',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, data)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_account_balances TO authenticated;
GRANT ALL ON public.bank_account_balances TO service_role;
ALTER TABLE public.bank_account_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY bab_admin ON public.bank_account_balances FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.bank_account_balances (school_id, account_id, data, saldo_conta, saldo_aplicado, origem)
SELECT a.school_id, a.id, a.saldo_inicial_data, a.saldo_inicial,
       CASE WHEN a.has_auto_invest THEN a.auto_invest_saldo_inicial ELSE 0 END, 'cadastro'
FROM public.bank_accounts a WHERE a.saldo_inicial_data IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Tipo financeiro vinculado ao item do modelo da escola
ALTER TABLE public.bank_transactions ADD COLUMN model_item_id uuid REFERENCES public.financial_model_template_items(id) ON DELETE SET NULL;
ALTER TABLE public.bank_transaction_splits ADD COLUMN model_item_id uuid REFERENCES public.financial_model_template_items(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.validate_bank_model_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.model_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.financial_model_template_items i
    JOIN public.schools s ON s.financial_model_template_id = i.template_id
    WHERE i.id = NEW.model_item_id AND s.id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'Tipo financeiro não pertence ao modelo desta empresa.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER validate_bank_tx_model_item BEFORE INSERT OR UPDATE OF model_item_id ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.validate_bank_model_item();
CREATE TRIGGER validate_bank_split_model_item BEFORE INSERT OR UPDATE OF model_item_id ON public.bank_transaction_splits
  FOR EACH ROW EXECUTE FUNCTION public.validate_bank_model_item();

-- 4. Linhas financeiras geradas pelo Fluxo de Caixa (tabela própria: nunca toca financial_entries)
CREATE TABLE public.bank_cashflow_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  bank_transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  bank_split_id uuid REFERENCES public.bank_transaction_splits(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  data text NOT NULL CHECK (data >= '2026-09-01'),
  descricao text NOT NULL,
  valor numeric NOT NULL CHECK (valor >= 0),
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  model_item_id uuid,
  tipo_nome text NOT NULL,
  recon_status text NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bce_unique_tx ON public.bank_cashflow_entries (bank_transaction_id) WHERE bank_split_id IS NULL;
CREATE UNIQUE INDEX bce_unique_split ON public.bank_cashflow_entries (bank_split_id) WHERE bank_split_id IS NOT NULL;
CREATE INDEX bce_school_data ON public.bank_cashflow_entries (school_id, data);
GRANT SELECT ON public.bank_cashflow_entries TO authenticated;
GRANT ALL ON public.bank_cashflow_entries TO service_role;
ALTER TABLE public.bank_cashflow_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY bce_select ON public.bank_cashflow_entries FOR SELECT TO authenticated USING (
  public.is_admin() OR (
    public.user_has_school_access(auth.uid(), school_id)
    AND EXISTS (SELECT 1 FROM public.school_data_sources d WHERE d.school_id = bank_cashflow_entries.school_id AND d.status = 'ativo')
  )
);

-- 5. Sincronização idempotente por movimentação
CREATE OR REPLACE FUNCTION public.sync_bank_cashflow_tx(_tx_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _tx public.bank_transactions;
  _cfg public.school_data_sources;
  _floor text;
  _split_sum numeric;
  _n_splits int;
  _s record;
  _desc text;
BEGIN
  SELECT * INTO _tx FROM public.bank_transactions WHERE id = _tx_id;
  IF NOT FOUND THEN RETURN; END IF;
  -- Só mexe nas próprias linhas geradas
  DELETE FROM public.bank_cashflow_entries WHERE bank_transaction_id = _tx_id;

  SELECT * INTO _cfg FROM public.school_data_sources WHERE school_id = _tx.school_id AND status IN ('em_conferencia','ativo');
  IF NOT FOUND THEN RETURN; END IF;
  _floor := greatest(_cfg.start_month || '-01', '2026-09-01');
  IF _tx.data < _floor THEN RETURN; END IF;

  -- Neutros no consolidado: aplicação/resgate automático do principal e transferência com as duas pontas
  IF _tx.movement_kind IN ('auto_aplicacao','auto_resgate') THEN RETURN; END IF;
  IF _tx.transfer_pair_id IS NOT NULL THEN RETURN; END IF;

  _desc := coalesce(nullif(btrim(_tx.descricao_editada), ''), _tx.descricao);

  SELECT count(*), coalesce(sum(valor), 0) INTO _n_splits, _split_sum FROM public.bank_transaction_splits WHERE transaction_id = _tx_id;
  IF _n_splits > 0 THEN
    IF abs(round(_split_sum, 2) - round(_tx.valor, 2)) > 0.004 THEN RETURN; END IF; -- divisão com diferença: não sincroniza
    FOR _s IN SELECT sp.*, i.name AS item_name FROM public.bank_transaction_splits sp
              LEFT JOIN public.financial_model_template_items i ON i.id = sp.model_item_id
              WHERE sp.transaction_id = _tx_id LOOP
      INSERT INTO public.bank_cashflow_entries (school_id, bank_transaction_id, bank_split_id, account_id, data, descricao, valor, tipo, model_item_id, tipo_nome, recon_status)
      VALUES (_tx.school_id, _tx_id, _s.id, _tx.account_id, _tx.data, coalesce(nullif(btrim(_s.descricao), ''), _desc), round(_s.valor, 2), _tx.tipo, _s.model_item_id,
        CASE WHEN _s.categoria = 'ignorar' THEN 'Ignorar' ELSE coalesce(btrim(_s.item_name), 'A classificar') END, _tx.recon_status);
    END LOOP;
    RETURN;
  END IF;

  INSERT INTO public.bank_cashflow_entries (school_id, bank_transaction_id, account_id, data, descricao, valor, tipo, model_item_id, tipo_nome, recon_status)
  SELECT _tx.school_id, _tx_id, _tx.account_id, _tx.data, _desc, round(abs(_tx.valor), 2), _tx.tipo, _tx.model_item_id,
    CASE WHEN _tx.movement_kind = 'ignorar' THEN 'Ignorar' ELSE coalesce(btrim(i.name), 'A classificar') END, _tx.recon_status
  FROM (SELECT 1) x LEFT JOIN public.financial_model_template_items i ON i.id = _tx.model_item_id;
END; $$;

CREATE OR REPLACE FUNCTION public.refresh_bank_cashflow_status(_school_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.school_data_sources d SET
    last_synced_at = now(),
    last_error = NULL,
    synced_through = (
      SELECT min(mx) FROM (
        SELECT (SELECT max(b.data) FROM public.bank_transactions b WHERE b.account_id = a.id) AS mx
        FROM public.bank_accounts a WHERE a.school_id = _school_id AND a.ativa
      ) z
    )
  WHERE d.school_id = _school_id;
END; $$;

CREATE OR REPLACE FUNCTION public.sync_bank_cashflow_school(_school_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _r record; _n int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito à equipe.'; END IF;
  FOR _r IN SELECT id FROM public.bank_transactions WHERE school_id = _school_id AND data >= '2026-09-01' LOOP
    PERFORM public.sync_bank_cashflow_tx(_r.id); _n := _n + 1;
  END LOOP;
  PERFORM public.refresh_bank_cashflow_status(_school_id);
  RETURN _n;
END; $$;

-- 6. Triggers automáticos (erros não bloqueiam o extrato; ficam registrados)
CREATE OR REPLACE FUNCTION public.bank_cashflow_tx_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _sid uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.school_id ELSE NEW.school_id END;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.school_data_sources WHERE school_id = _sid AND status IN ('em_conferencia','ativo')) THEN
    RETURN NULL;
  END IF;
  BEGIN
    IF TG_OP <> 'DELETE' THEN
      PERFORM public.sync_bank_cashflow_tx(NEW.id);
      -- a outra ponta de uma transferência também muda quando o par é definido/desfeito
      IF TG_OP = 'UPDATE' AND OLD.transfer_pair_id IS DISTINCT FROM NEW.transfer_pair_id THEN
        IF OLD.transfer_pair_id IS NOT NULL THEN PERFORM public.sync_bank_cashflow_tx(OLD.transfer_pair_id); END IF;
        IF NEW.transfer_pair_id IS NOT NULL THEN PERFORM public.sync_bank_cashflow_tx(NEW.transfer_pair_id); END IF;
      END IF;
    END IF;
    PERFORM public.refresh_bank_cashflow_status(_sid);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.school_data_sources SET last_error = left(SQLERRM, 500) WHERE school_id = _sid;
  END;
  RETURN NULL;
END; $$;
CREATE TRIGGER bank_cashflow_sync_tx AFTER INSERT OR UPDATE OR DELETE ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.bank_cashflow_tx_trigger();

CREATE OR REPLACE FUNCTION public.bank_cashflow_split_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tx uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.transaction_id ELSE NEW.transaction_id END;
        _sid uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.school_id ELSE NEW.school_id END;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.school_data_sources WHERE school_id = _sid AND status IN ('em_conferencia','ativo')) THEN
    RETURN NULL;
  END IF;
  BEGIN
    PERFORM public.sync_bank_cashflow_tx(_tx);
    PERFORM public.refresh_bank_cashflow_status(_sid);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.school_data_sources SET last_error = left(SQLERRM, 500) WHERE school_id = _sid;
  END;
  RETURN NULL;
END; $$;
CREATE TRIGGER bank_cashflow_sync_split AFTER INSERT OR UPDATE OR DELETE ON public.bank_transaction_splits
  FOR EACH ROW EXECUTE FUNCTION public.bank_cashflow_split_trigger();

-- Histórico da troca de tipo financeiro
CREATE OR REPLACE FUNCTION public.log_bank_model_item_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.model_item_id IS DISTINCT FROM OLD.model_item_id THEN
    INSERT INTO public.bank_reconciliation_history (school_id, transaction_id, old_status, new_status, note, changed_by, changed_by_email)
    VALUES (NEW.school_id, NEW.id, NEW.recon_status, NEW.recon_status,
      'Tipo financeiro: ' || coalesce((SELECT name FROM public.financial_model_template_items WHERE id = OLD.model_item_id), 'A classificar')
      || ' → ' || coalesce((SELECT name FROM public.financial_model_template_items WHERE id = NEW.model_item_id), 'A classificar'),
      auth.uid(), (SELECT email FROM public.profiles WHERE user_id = auth.uid()));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER log_bank_tx_model_item AFTER UPDATE OF model_item_id ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_bank_model_item_change();

REVOKE EXECUTE ON FUNCTION public.sync_bank_cashflow_tx(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_bank_cashflow_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_bank_cashflow_school(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_bank_cashflow_school(uuid) TO authenticated;