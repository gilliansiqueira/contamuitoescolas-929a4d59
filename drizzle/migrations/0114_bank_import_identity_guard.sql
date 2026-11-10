ALTER TABLE public.bank_accounts ADD COLUMN bank_code text, ADD COLUMN holder_document text, ADD COLUMN identity_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.bank_statement_imports ADD COLUMN identity_checked boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.bank_identity_norm(v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE WHEN upper(trim(coalesce(v,''))) ~ '^[0-9X .\-/]+$' THEN regexp_replace(upper(trim(v)), '[ .\-/]', '', 'g') ELSE '' END $$;
CREATE OR REPLACE FUNCTION public.bank_import_allowed(_school uuid,_account uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND public.is_admin() AND public.can_see_school(_school) AND EXISTS(SELECT 1 FROM public.bank_accounts a WHERE a.id=_account AND a.school_id=_school AND a.ativa AND NOT a.is_virtual) $$;
REVOKE ALL ON FUNCTION public.bank_import_allowed(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bank_import_allowed(uuid,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.guard_bank_account_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF NEW.identity_verified THEN
 IF NEW.bank_code IS NULL OR NEW.bank_code !~ '^[0-9]{3}$' OR public.bank_identity_norm(NEW.agencia)='' OR public.bank_identity_norm(NEW.conta)='' THEN RAISE EXCEPTION 'Complete banco/código, agência e conta com dígito antes de conferir o cadastro.'; END IF;
 IF NEW.holder_document IS NOT NULL AND NEW.holder_document<>'' AND public.bank_identity_norm(NEW.holder_document) !~ '^([0-9]{11}|[0-9]{14})$' THEN RAISE EXCEPTION 'Documento do titular inválido.'; END IF;
 IF EXISTS(SELECT 1 FROM public.bank_accounts a WHERE a.id<>NEW.id AND a.identity_verified AND a.bank_code=NEW.bank_code AND public.bank_identity_norm(a.agencia)=public.bank_identity_norm(NEW.agencia) AND public.bank_identity_norm(a.conta)=public.bank_identity_norm(NEW.conta)) THEN RAISE EXCEPTION 'Identidade bancária já vinculada a outra conta. Confira o vínculo autorizado.'; END IF;
END IF;
RETURN NEW; END $$;
CREATE TRIGGER bank_account_identity_guard BEFORE INSERT OR UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.guard_bank_account_identity();
CREATE OR REPLACE FUNCTION public.guard_bank_import_destination() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ DECLARE a public.bank_accounts; BEGIN
SELECT * INTO a FROM public.bank_accounts WHERE id=NEW.account_id;
IF a.id IS NULL OR a.school_id<>NEW.school_id THEN RAISE EXCEPTION 'Conta não vinculada à empresa.'; END IF;
IF TG_OP='UPDATE' AND (NEW.school_id IS DISTINCT FROM OLD.school_id OR NEW.account_id IS DISTINCT FROM OLD.account_id OR NEW.identity_checked IS DISTINCT FROM OLD.identity_checked) THEN RAISE EXCEPTION 'Destino e validação do extrato são imutáveis.'; END IF;
IF TG_OP='INSERT' AND coalesce(auth.role(),'')<>'service_role' AND (NEW.file_path IS NOT NULL OR NEW.total_linhas>0 OR NEW.identity_checked OR NEW.formato='api_inter' OR NEW.file_hash NOT LIKE 'manual-%' OR NOT public.is_super_admin()) THEN RAISE EXCEPTION 'Extratos devem ser validados pelo servidor antes de gravar.'; END IF;
RETURN NEW; END $$;
CREATE TRIGGER bank_import_destination_guard BEFORE INSERT OR UPDATE ON public.bank_statement_imports FOR EACH ROW EXECUTE FUNCTION public.guard_bank_import_destination();
CREATE OR REPLACE FUNCTION public.guard_bank_tx_destination() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM public.bank_accounts a WHERE a.id=NEW.account_id AND a.school_id=NEW.school_id) THEN RAISE EXCEPTION 'Destino bancário inválido.'; END IF;
IF NEW.manual_pair_id IS NOT NULL THEN
 IF NOT EXISTS(SELECT 1 FROM public.bank_accounts a WHERE a.id=NEW.account_id AND a.is_virtual) THEN RAISE EXCEPTION 'Conta virtual necessária.'; END IF;
ELSE
 IF NOT EXISTS(SELECT 1 FROM public.bank_statement_imports i WHERE i.id=NEW.import_id AND i.account_id=NEW.account_id AND i.school_id=NEW.school_id) THEN RAISE EXCEPTION 'Lançamento não pertence ao destino do extrato.'; END IF;
 IF TG_OP='INSERT' AND coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Importação de movimentos exige validação no servidor.'; END IF;
END IF;
RETURN NEW; END $$;
CREATE TRIGGER bank_tx_destination_guard BEFORE INSERT ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION public.guard_bank_tx_destination();
CREATE OR REPLACE FUNCTION public.commit_verified_bank_import(_user uuid,_school uuid,_account uuid,_identity jsonb,_meta jsonb,_rows jsonb,_links jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.bank_accounts; iid uuid; r jsonb; BEGIN
IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Acesso não autorizado.'; END IF;
IF NOT (public.has_role(_user,'admin') OR public.has_role(_user,'super_admin')) OR (EXISTS(SELECT 1 FROM public.schools WHERE id=_school AND restrita) AND NOT public.has_role(_user,'super_admin')) THEN RAISE EXCEPTION 'Sem autorização para esta empresa.'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(_account::text,0));
SELECT * INTO a FROM public.bank_accounts WHERE id=_account AND school_id=_school FOR UPDATE;
IF a.id IS NULL OR NOT a.ativa OR a.is_virtual OR NOT a.identity_verified THEN RAISE EXCEPTION 'Complete o cadastro autorizado da conta.'; END IF;
IF coalesce((_identity->>'ambiguous')::boolean,false) OR coalesce(_identity->>'bankCode','') !~ '^[0-9]{1,3}$' OR lpad(_identity->>'bankCode',3,'0')<>a.bank_code OR public.bank_identity_norm(_identity->>'branch')='' OR public.bank_identity_norm(_identity->>'branch')<>public.bank_identity_norm(a.agencia) OR public.bank_identity_norm(_identity->>'account')='' OR public.bank_identity_norm(_identity->>'account')<>public.bank_identity_norm(a.conta) THEN RAISE EXCEPTION 'Identidade do extrato diverge do destino.'; END IF;
IF _identity ? 'holderDocument' AND (public.bank_identity_norm(_identity->>'holderDocument') !~ '^([0-9]{11}|[0-9]{14})$' OR public.bank_identity_norm(_identity->>'holderDocument')<>public.bank_identity_norm(a.holder_document)) THEN RAISE EXCEPTION 'Titular diverge do cadastro autorizado.'; END IF;
IF EXISTS(SELECT 1 FROM public.bank_accounts b WHERE b.id<>a.id AND b.identity_verified AND b.bank_code=a.bank_code AND public.bank_identity_norm(b.agencia)=public.bank_identity_norm(a.agencia) AND public.bank_identity_norm(b.conta)=public.bank_identity_norm(a.conta)) THEN RAISE EXCEPTION 'Vínculo bancário ambíguo.'; END IF;
IF jsonb_typeof(_rows)<>'array' OR jsonb_array_length(_rows)>20000 OR _meta->>'formato' NOT IN ('ofx','csv','xlsx') OR _meta->>'file_hash' !~ '^[a-f0-9]{64}$' OR _meta->>'file_path' NOT LIKE _school::text||'/'||_account::text||'/%' THEN RAISE EXCEPTION 'Lote inválido.'; END IF;
SELECT id INTO iid FROM public.bank_statement_imports WHERE account_id=_account AND file_hash=_meta->>'file_hash';
IF iid IS NOT NULL THEN RAISE EXCEPTION 'Arquivo já importado.'; END IF;
INSERT INTO public.bank_statement_imports(school_id,account_id,file_name,file_path,file_hash,formato,periodo_inicio,periodo_fim,total_linhas,inseridas,duplicadas,total_entradas,total_saidas,imported_by,saldo_final_informado,saldo_aplicado_informado,saldo_retido_informado,identity_checked)
VALUES(_school,_account,_meta->>'file_name',_meta->>'file_path',_meta->>'file_hash',_meta->>'formato',_meta->>'periodo_inicio',_meta->>'periodo_fim',(_meta->>'total_linhas')::int,jsonb_array_length(_rows),(_meta->>'duplicadas')::int,(_meta->>'total_entradas')::numeric,(_meta->>'total_saidas')::numeric,_user,(_meta->>'saldo_final_informado')::numeric,(_meta->>'saldo_aplicado_informado')::numeric,(_meta->>'saldo_retido_informado')::numeric,true) RETURNING id INTO iid;
FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
 INSERT INTO public.bank_transactions(school_id,account_id,import_id,data,descricao,valor,tipo,bank_ref,dedup_hash,movement_kind,is_forecast) VALUES(_school,_account,iid,r->>'data',r->>'descricao',(r->>'valor')::numeric,r->>'tipo',r->>'bank_ref',r->>'dedup_hash',r->>'movement_kind',coalesce((r->>'is_forecast')::boolean,false)) ON CONFLICT(account_id,dedup_hash) DO NOTHING;
END LOOP;
FOR r IN SELECT value FROM jsonb_array_elements(_links) LOOP
 UPDATE public.bank_transactions SET bank_ref=r->>'bankRef' WHERE id=(r->>'id')::uuid AND account_id=_account AND school_id=_school AND (bank_ref IS NULL OR coalesce((r->>'replace')::boolean,false));
END LOOP;
RETURN iid; END $$;
REVOKE ALL ON FUNCTION public.commit_verified_bank_import(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_verified_bank_import(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb) TO service_role;
COMMENT ON COLUMN public.bank_accounts.identity_verified IS 'Explicit account identity confirmation by authorized team; never backfilled from historical uploads.';