CREATE OR REPLACE FUNCTION public.guard_bank_import_destination() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE a public.bank_accounts;
BEGIN
SELECT * INTO a FROM public.bank_accounts WHERE id=NEW.account_id;
IF a.id IS NULL OR a.school_id<>NEW.school_id THEN RAISE EXCEPTION 'Conta não vinculada à empresa.'; END IF;
IF TG_OP='UPDATE' AND (NEW.school_id IS DISTINCT FROM OLD.school_id OR NEW.account_id IS DISTINCT FROM OLD.account_id OR NEW.identity_checked IS DISTINCT FROM OLD.identity_checked OR NEW.identity_status IS DISTINCT FROM OLD.identity_status) THEN RAISE EXCEPTION 'Destino e validação do extrato são imutáveis.'; END IF;
IF TG_OP='INSERT' AND NEW.lolli_origin_upload_id IS NOT NULL AND a.lolli_origin_upload_id=NEW.lolli_origin_upload_id AND NEW.file_path IS NULL AND EXISTS(SELECT 1 FROM public.lolli_bank_source b WHERE b.school_id=NEW.school_id AND b.origem_upload_id=NEW.lolli_origin_upload_id AND b.source_table='bank_transactions' AND b.original->>'account_id'=NEW.account_id::text AND b.original->>'arquivo_nome'=NEW.file_name) THEN RETURN NEW; END IF;
IF TG_OP='INSERT' AND coalesce(auth.role(),'')<>'service_role' AND (NEW.identity_checked OR NEW.identity_status IS NOT NULL OR (public.bank_import_guard_enforced() AND (NEW.file_path IS NOT NULL OR NEW.total_linhas>0 OR NEW.formato='api_inter' OR NEW.file_hash NOT LIKE 'manual-%' OR NOT public.is_super_admin()))) THEN RAISE EXCEPTION 'Extratos devem ser validados pelo servidor antes de gravar.'; END IF;
RETURN NEW; END $function$;
CREATE OR REPLACE FUNCTION public.guard_bank_tx_destination() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
IF NOT EXISTS(SELECT 1 FROM public.bank_accounts a WHERE a.id=NEW.account_id AND a.school_id=NEW.school_id) THEN RAISE EXCEPTION 'Destino bancário inválido.'; END IF;
IF NEW.manual_pair_id IS NOT NULL THEN IF NOT EXISTS(SELECT 1 FROM public.bank_accounts a WHERE a.id=NEW.account_id AND a.is_virtual) THEN RAISE EXCEPTION 'Conta virtual necessária.'; END IF;
ELSE
IF NOT EXISTS(SELECT 1 FROM public.bank_statement_imports i WHERE i.id=NEW.import_id AND i.account_id=NEW.account_id AND i.school_id=NEW.school_id) THEN RAISE EXCEPTION 'Lançamento não pertence ao destino do extrato.'; END IF;
IF TG_OP='INSERT' AND NEW.lolli_origin_upload_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.bank_statement_imports i JOIN public.lolli_bank_source b ON b.origem_upload_id=i.lolli_origin_upload_id AND b.school_id=i.school_id WHERE i.id=NEW.import_id AND i.lolli_origin_upload_id=NEW.lolli_origin_upload_id AND b.source_table='bank_transactions' AND b.source_id=NEW.id::text AND b.original->>'account_id'=NEW.account_id::text AND b.original->>'data'=NEW.data AND b.original->>'descricao'=NEW.descricao AND abs((b.original->>'valor')::numeric)=NEW.valor AND (CASE WHEN (b.original->>'valor')::numeric>=0 THEN 'entrada' ELSE 'saida' END)=NEW.tipo) THEN RETURN NEW; END IF;
IF TG_OP='INSERT' AND public.bank_import_guard_enforced() AND coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Importação de movimentos exige validação no servidor.'; END IF;
END IF;
RETURN NEW; END $function$;