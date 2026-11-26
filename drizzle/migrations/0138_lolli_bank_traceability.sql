ALTER TABLE public.bank_accounts ADD COLUMN lolli_origin_upload_id uuid REFERENCES public.lolli_import_batches(id) ON DELETE CASCADE;
ALTER TABLE public.bank_account_balances ADD COLUMN lolli_origin_upload_id uuid REFERENCES public.lolli_import_batches(id) ON DELETE CASCADE;
ALTER TABLE public.bank_balances ADD COLUMN lolli_origin_upload_id uuid REFERENCES public.lolli_import_batches(id) ON DELETE CASCADE;
ALTER TABLE public.bank_statement_imports ADD COLUMN lolli_origin_upload_id uuid REFERENCES public.lolli_import_batches(id) ON DELETE CASCADE;
ALTER TABLE public.bank_transactions ADD COLUMN lolli_origin_upload_id uuid REFERENCES public.lolli_import_batches(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION public.bank_tx_force_pending() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE original_row jsonb;
BEGIN
  IF NEW.lolli_origin_upload_id IS NOT NULL THEN
    SELECT original INTO original_row FROM public.lolli_bank_source WHERE origem_upload_id=NEW.lolli_origin_upload_id AND school_id=NEW.school_id AND source_table='bank_transactions' AND source_id=NEW.id::text;
    IF original_row IS NOT NULL AND original_row->>'data'=NEW.data AND original_row->>'account_id'=NEW.account_id::text AND abs((original_row->>'valor')::numeric)=NEW.valor THEN
      NEW.recon_status := CASE WHEN original_row->>'status'='conciliado' THEN 'conciliado' WHEN original_row->>'status'='ignorado' THEN 'nao_se_aplica' ELSE 'pendente' END;
      NEW.recon_by := NULL; NEW.recon_by_email := NULL;
      NEW.recon_at := CASE WHEN NEW.recon_status='conciliado' THEN (original_row->>'updated_at')::timestamptz ELSE NULL END;
      NEW.recon_source := 'lolli_export';
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Movimento importado não corresponde ao original da Lolli.';
  END IF;
  NEW.recon_status := 'pendente'; NEW.recon_by := NULL; NEW.recon_by_email := NULL; NEW.recon_at := NULL;
  IF public.bank_tx_auto_recon_eligible(NEW.school_id, NEW.descricao, NEW.tipo, NEW.movement_kind, NEW.model_item_id, NEW.transfer_pair_id, NEW.is_forecast) THEN
    NEW.recon_status := 'conciliado'; NEW.recon_at := now(); NEW.recon_by_email := 'automático';
    NEW.recon_source := 'auto_regra'; NEW.recon_note := 'automática (regra Joinville)';
  END IF;
  RETURN NEW;
END; $function$;