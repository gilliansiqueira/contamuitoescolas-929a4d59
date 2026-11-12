CREATE OR REPLACE FUNCTION public.bank_tx_auto_recon_eligible(_school uuid, _desc text, _tipo text, _mk text, _item uuid, _pair uuid, _forecast boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _item IS NOT NULL AND coalesce(_mk,'normal') = 'normal' AND _pair IS NULL AND NOT coalesce(_forecast,false)
    AND (upper(coalesce(_desc,'')) ~ '(^|[^A-Z])(PIX|TED)([^A-Z]|$)' OR _tipo = 'saida')
    AND EXISTS (SELECT 1 FROM public.school_features f WHERE f.school_id = _school AND f.feature_key = 'auto_recon_pix_ted_despesas' AND f.enabled)
$$;

CREATE OR REPLACE FUNCTION public.bank_tx_force_pending()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.recon_status := 'pendente'; NEW.recon_by := NULL; NEW.recon_by_email := NULL; NEW.recon_at := NULL;
  IF public.bank_tx_auto_recon_eligible(NEW.school_id, NEW.descricao, NEW.tipo, NEW.movement_kind, NEW.model_item_id, NEW.transfer_pair_id, NEW.is_forecast) THEN
    NEW.recon_status := 'conciliado'; NEW.recon_at := now(); NEW.recon_by_email := 'automático';
    NEW.recon_source := 'auto_regra'; NEW.recon_note := 'automática (regra Joinville)';
  END IF;
  RETURN NEW;
END; $$;

-- Item do modelo definido depois: concilia se elegível
CREATE OR REPLACE FUNCTION public.bank_tx_auto_recon_on_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.recon_status = 'pendente' AND NEW.recon_status = 'pendente' AND OLD.model_item_id IS NULL
     AND public.bank_tx_auto_recon_eligible(NEW.school_id, NEW.descricao, NEW.tipo, NEW.movement_kind, NEW.model_item_id, NEW.transfer_pair_id, NEW.is_forecast) THEN
    NEW.recon_status := 'conciliado'; NEW.recon_at := now(); NEW.recon_by_email := 'automático';
    NEW.recon_source := 'auto_regra'; NEW.recon_note := 'automática (regra Joinville)';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER bank_tx_auto_recon_on_item BEFORE UPDATE OF model_item_id ON public.bank_transactions
FOR EACH ROW EXECUTE FUNCTION public.bank_tx_auto_recon_on_item();

CREATE OR REPLACE FUNCTION public.bank_tx_auto_recon_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.recon_source = 'auto_regra' AND NEW.recon_status = 'conciliado'
     AND (TG_OP = 'INSERT' OR OLD.recon_status IS DISTINCT FROM 'conciliado') THEN
    INSERT INTO public.bank_reconciliation_history(school_id, transaction_id, old_status, new_status, note, changed_by_email)
    VALUES (NEW.school_id, NEW.id, 'pendente', 'conciliado', 'automática (regra Joinville)', 'automático');
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER bank_tx_auto_recon_log AFTER INSERT OR UPDATE OF recon_status ON public.bank_transactions
FOR EACH ROW EXECUTE FUNCTION public.bank_tx_auto_recon_log();

REVOKE EXECUTE ON FUNCTION public.bank_tx_auto_recon_eligible(uuid,text,text,text,uuid,uuid,boolean) FROM PUBLIC, anon;