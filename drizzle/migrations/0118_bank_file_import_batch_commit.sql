CREATE OR REPLACE FUNCTION public.guard_bank_account_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE code text; old_key bigint; new_key bigint; lock_key bigint;
BEGIN
code:=public.bank_registered_code(NEW.banco,NEW.bank_code);
IF coalesce(NEW.bank_code,'')<>'' AND code='' THEN RAISE EXCEPTION 'Código do banco inválido ou incompatível.'; END IF;
IF NEW.holder_entity_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_entities e WHERE e.id=NEW.holder_entity_id AND e.school_id=NEW.school_id AND (coalesce(NEW.holder_document,'')='' OR public.bank_identity_norm(e.cnpj)=public.bank_identity_norm(NEW.holder_document))) THEN RAISE EXCEPTION 'Titular específico não pertence à empresa ou documento diverge.'; END IF;
IF coalesce(NEW.holder_document,'')<>'' AND public.bank_identity_norm(NEW.holder_document) !~ '^([0-9]{11}|[0-9]{14})$' THEN RAISE EXCEPTION 'Documento do titular inválido.'; END IF;
IF TG_OP='INSERT' OR NEW.banco IS DISTINCT FROM OLD.banco OR NEW.bank_code IS DISTINCT FROM OLD.bank_code OR NEW.agencia IS DISTINCT FROM OLD.agencia OR NEW.conta IS DISTINCT FROM OLD.conta OR NEW.school_id IS DISTINCT FROM OLD.school_id OR NEW.is_virtual IS DISTINCT FROM OLD.is_virtual THEN
 IF TG_OP='UPDATE' THEN old_key:=hashtextextended(public.bank_registered_code(OLD.banco,OLD.bank_code)||'|'||public.bank_identity_norm(OLD.agencia)||'|'||public.bank_identity_norm(OLD.conta),7711442201); END IF;
 new_key:=hashtextextended(code||'|'||public.bank_identity_norm(NEW.agencia)||'|'||public.bank_identity_norm(NEW.conta),7711442201);
 FOR lock_key IN SELECT DISTINCT k FROM unnest(ARRAY[old_key,new_key]) k WHERE k IS NOT NULL ORDER BY k LOOP PERFORM pg_advisory_xact_lock(lock_key); END LOOP;
 IF NOT NEW.is_virtual AND code<>'' AND public.bank_identity_norm(NEW.agencia)<>'' AND public.bank_identity_norm(NEW.conta)<>'' AND EXISTS(SELECT 1 FROM public.bank_accounts a WHERE a.id<>NEW.id AND NOT a.is_virtual AND public.bank_registered_code(a.banco,a.bank_code)=code AND public.bank_identity_norm(a.agencia)=public.bank_identity_norm(NEW.agencia) AND public.bank_identity_norm(a.conta)=public.bank_identity_norm(NEW.conta)) THEN RAISE EXCEPTION 'Cadastro bancário duplicado ou ambíguo. Corrija o vínculo da conta.'; END IF;
END IF;
RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.commit_verified_bank_import(_user uuid,_school uuid,_account uuid,_identity jsonb,_meta jsonb,_rows jsonb,_links jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE a public.bank_accounts; iid uuid; code text; doc text; inserted_count integer; total_count integer; BEGIN
IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Acesso não autorizado.'; END IF;
IF NOT (public.has_role(_user,'admin') OR public.has_role(_user,'super_admin')) OR (EXISTS(SELECT 1 FROM public.schools WHERE id=_school AND restrita) AND NOT public.has_role(_user,'super_admin')) THEN RAISE EXCEPTION 'Sem autorização para esta empresa.'; END IF;
SELECT * INTO a FROM public.bank_accounts WHERE id=_account AND school_id=_school FOR UPDATE;
IF a.id IS NULL OR NOT a.ativa OR a.is_virtual THEN RAISE EXCEPTION 'Conta não vinculada à empresa.'; END IF;
code:=public.bank_registered_code(a.banco,a.bank_code);
PERFORM pg_advisory_xact_lock_shared(hashtextextended(code||'|'||public.bank_identity_norm(a.agencia)||'|'||public.bank_identity_norm(a.conta),7711442201));
IF code='' OR public.bank_identity_norm(a.agencia)='' OR public.bank_identity_norm(a.conta)='' THEN RAISE EXCEPTION 'Complete o cadastro da conta.'; END IF;
IF coalesce((_identity->>'ambiguous')::boolean,false) OR coalesce(_identity->>'bankCode','') !~ '^[0-9]{1,3}$' OR lpad(_identity->>'bankCode',3,'0')<>code OR public.bank_identity_norm(_identity->>'branch')='' OR public.bank_identity_norm(_identity->>'branch')<>public.bank_identity_norm(a.agencia) OR public.bank_identity_norm(_identity->>'account')='' OR public.bank_identity_norm(_identity->>'account')<>public.bank_identity_norm(a.conta) THEN RAISE EXCEPTION 'Identidade do extrato diverge do destino.'; END IF;
doc:=public.bank_identity_norm(a.holder_document);
IF a.holder_entity_id IS NOT NULL THEN
 SELECT public.bank_identity_norm(e.cnpj) INTO doc FROM public.company_entities e WHERE e.id=a.holder_entity_id AND e.school_id=a.school_id AND (coalesce(a.holder_document,'')='' OR public.bank_identity_norm(e.cnpj)=public.bank_identity_norm(a.holder_document)) FOR SHARE;
 IF doc IS NULL THEN RAISE EXCEPTION 'Vínculo do titular específico inválido.'; END IF;
END IF;
IF _identity ? 'holderDocument' AND (public.bank_identity_norm(_identity->>'holderDocument') !~ '^([0-9]{11}|[0-9]{14})$' OR public.bank_identity_norm(_identity->>'holderDocument')<>coalesce(doc,'')) THEN RAISE EXCEPTION 'Titular diverge do cadastro autorizado.'; END IF;
IF EXISTS(SELECT 1 FROM public.bank_accounts b WHERE b.id<>a.id AND NOT b.is_virtual AND public.bank_registered_code(b.banco,b.bank_code)=code AND public.bank_identity_norm(b.agencia)=public.bank_identity_norm(a.agencia) AND public.bank_identity_norm(b.conta)=public.bank_identity_norm(a.conta)) THEN RAISE EXCEPTION 'Vínculo bancário ambíguo.'; END IF;
IF jsonb_typeof(_rows) IS DISTINCT FROM 'array' OR jsonb_typeof(_links) IS DISTINCT FROM 'array' OR jsonb_array_length(_rows)>20000 OR _meta->>'formato' NOT IN('ofx','csv','xlsx') OR _meta->>'file_hash' !~ '^[a-f0-9]{64}$' OR _meta->>'file_path' NOT LIKE _school::text||'/'||_account::text||'/%' THEN RAISE EXCEPTION 'Lote inválido.'; END IF;
total_count:=(_meta->>'total_linhas')::int;
IF total_count IS NULL OR total_count<jsonb_array_length(_rows) THEN RAISE EXCEPTION 'Contagem do lote inválida.'; END IF;
SELECT id INTO iid FROM public.bank_statement_imports WHERE account_id=_account AND file_hash=_meta->>'file_hash'; IF iid IS NOT NULL THEN RAISE EXCEPTION 'Arquivo já importado.'; END IF;
INSERT INTO public.bank_statement_imports(school_id,account_id,file_name,file_path,file_hash,formato,periodo_inicio,periodo_fim,total_linhas,inseridas,duplicadas,total_entradas,total_saidas,imported_by,saldo_final_informado,saldo_aplicado_informado,saldo_retido_informado,identity_checked) VALUES(_school,_account,_meta->>'file_name',_meta->>'file_path',_meta->>'file_hash',_meta->>'formato',_meta->>'periodo_inicio',_meta->>'periodo_fim',(_meta->>'total_linhas')::int,jsonb_array_length(_rows),(_meta->>'duplicadas')::int,(_meta->>'total_entradas')::numeric,(_meta->>'total_saidas')::numeric,_user,(_meta->>'saldo_final_informado')::numeric,(_meta->>'saldo_aplicado_informado')::numeric,(_meta->>'saldo_retido_informado')::numeric,true) RETURNING id INTO iid;
INSERT INTO public.bank_transactions(school_id,account_id,import_id,data,descricao,valor,tipo,bank_ref,dedup_hash,movement_kind,is_forecast)
SELECT _school,_account,iid,r->>'data',r->>'descricao',(r->>'valor')::numeric,r->>'tipo',r->>'bank_ref',r->>'dedup_hash',r->>'movement_kind',coalesce((r->>'is_forecast')::boolean,false)
FROM jsonb_array_elements(_rows) AS source(r)
ON CONFLICT(account_id,dedup_hash) DO NOTHING;
GET DIAGNOSTICS inserted_count = ROW_COUNT;
UPDATE public.bank_statement_imports SET inseridas=inserted_count,duplicadas=total_count-inserted_count WHERE id=iid;
WITH candidates AS (
 SELECT r,count(*) OVER(PARTITION BY r->>'id') AS uses FROM jsonb_array_elements(_links) AS source(r)
)
UPDATE public.bank_transactions t SET bank_ref=c.r->>'bankRef'
FROM candidates c
WHERE c.uses=1 AND t.id=(c.r->>'id')::uuid AND t.account_id=_account AND t.school_id=_school
AND nullif(c.r->>'bankRef','') IS NOT NULL
AND (t.bank_ref IS NULL OR (coalesce((c.r->>'replace')::boolean,false) AND c.r ? 'expectedBankRef' AND t.bank_ref=c.r->>'expectedBankRef'));
RETURN iid; END $$;