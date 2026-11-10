-- Owner instruction (2026-11-10): never block existing routines; only concrete header x registration divergences block.
ALTER TABLE public.bank_statement_imports ADD COLUMN IF NOT EXISTS identity_status text CHECK (identity_status IN ('verified','inconclusive'));
COMMENT ON COLUMN public.bank_statement_imports.identity_status IS 'NULL = legacy/manual/API; verified = every compared header field matched; inconclusive = imported with a non-blocking identity warning.';
CREATE OR REPLACE FUNCTION public.bank_identity_file_code(_v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN trim(coalesce(_v,'')) ~ '^[0-9]{1,8}$' AND length(ltrim(trim(_v),'0')) BETWEEN 1 AND 3 THEN lpad(ltrim(trim(_v),'0'),3,'0') ELSE '' END $$;
-- Known codes = values of BANK_ALIASES in supabase/functions/_shared/bankIdentity.ts (kept identical by a unit test).
CREATE OR REPLACE FUNCTION public.bank_identity_cmp_bank(_file text,_reg text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE f text:=public.bank_identity_file_code(_file); BEGIN
 IF trim(coalesce(_file,''))='' OR coalesce(_reg,'')='' THEN RETURN 'missing'; END IF;
 IF f='' THEN RETURN 'uncertain'; END IF;
 IF f=_reg THEN RETURN 'match'; END IF;
 IF f = ANY(ARRAY['237','748','756','001','341','077','104','033','260','336','422','041','084','197','290','323','380']) THEN RETURN 'mismatch'; END IF;
 RETURN 'uncertain'; END $$;
CREATE OR REPLACE FUNCTION public.bank_identity_cmp_num(_file text,_reg text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE a text:=public.bank_identity_norm(_file); b text:=public.bank_identity_norm(_reg); za text; zb text; s text; l text; BEGIN
 IF a='' OR b='' THEN RETURN CASE WHEN trim(coalesce(_file,''))<>'' AND a='' THEN 'uncertain' ELSE 'missing' END; END IF;
 za:=ltrim(a,'0'); zb:=ltrim(b,'0');
 IF za=zb THEN RETURN 'match'; END IF;
 IF length(za)<=length(zb) THEN s:=za; l:=zb; ELSE s:=zb; l:=za; END IF;
 IF s<>'' AND strpos(l,s)>0 THEN RETURN 'uncertain'; END IF;
 RETURN 'mismatch'; END $$;
-- Duplicate/ambiguous registrations only warn (never block saving or importing).
CREATE OR REPLACE FUNCTION public.bank_account_identity_shared(_account uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.bank_accounts a JOIN public.bank_accounts b ON b.id<>a.id AND NOT b.is_virtual
  AND public.bank_registered_code(b.banco,b.bank_code)=public.bank_registered_code(a.banco,a.bank_code)
  AND public.bank_identity_norm(b.agencia)=public.bank_identity_norm(a.agencia) AND public.bank_identity_norm(b.conta)=public.bank_identity_norm(a.conta)
  WHERE a.id=_account AND NOT a.is_virtual AND public.bank_registered_code(a.banco,a.bank_code)<>'' AND public.bank_identity_norm(a.agencia)<>'' AND public.bank_identity_norm(a.conta)<>'') $$;
REVOKE ALL ON FUNCTION public.bank_account_identity_shared(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bank_account_identity_shared(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.guard_bank_account_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE code text; BEGIN
code:=public.bank_registered_code(NEW.banco,NEW.bank_code);
IF coalesce(NEW.bank_code,'')<>'' AND code='' THEN RAISE EXCEPTION 'Código do banco inválido ou incompatível.'; END IF;
IF NEW.holder_entity_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_entities e WHERE e.id=NEW.holder_entity_id AND e.school_id=NEW.school_id AND (coalesce(NEW.holder_document,'')='' OR public.bank_identity_norm(e.cnpj)=public.bank_identity_norm(NEW.holder_document))) THEN RAISE EXCEPTION 'Titular específico não pertence à empresa ou documento diverge.'; END IF;
IF coalesce(NEW.holder_document,'')<>'' AND public.bank_identity_norm(NEW.holder_document) !~ '^([0-9]{11}|[0-9]{14})$' THEN RAISE EXCEPTION 'Documento do titular inválido.'; END IF;
RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.guard_bank_import_destination() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ DECLARE a public.bank_accounts; BEGIN SELECT * INTO a FROM public.bank_accounts WHERE id=NEW.account_id;
IF a.id IS NULL OR a.school_id<>NEW.school_id THEN RAISE EXCEPTION 'Conta não vinculada à empresa.'; END IF;
IF TG_OP='UPDATE' AND (NEW.school_id IS DISTINCT FROM OLD.school_id OR NEW.account_id IS DISTINCT FROM OLD.account_id OR NEW.identity_checked IS DISTINCT FROM OLD.identity_checked OR NEW.identity_status IS DISTINCT FROM OLD.identity_status) THEN RAISE EXCEPTION 'Destino e validação do extrato são imutáveis.'; END IF;
IF TG_OP='INSERT' AND coalesce(auth.role(),'')<>'service_role' AND (NEW.identity_checked OR NEW.identity_status IS NOT NULL OR (public.bank_import_guard_enforced() AND (NEW.file_path IS NOT NULL OR NEW.total_linhas>0 OR NEW.formato='api_inter' OR NEW.file_hash NOT LIKE 'manual-%' OR NOT public.is_super_admin()))) THEN RAISE EXCEPTION 'Extratos devem ser validados pelo servidor antes de gravar.'; END IF;
RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.commit_verified_bank_import(_user uuid,_school uuid,_account uuid,_identity jsonb,_meta jsonb,_rows jsonb,_links jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.bank_accounts; iid uuid; code text; doc text; edoc text; conflict boolean:=false; shared boolean; amb text[]; fdoc text;
 r_bank text; r_branch text; r_acc text; r_doc text; wrong text[]:='{}'; verified boolean; inserted_count integer; total_count integer; BEGIN
IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Acesso não autorizado.'; END IF;
IF NOT (public.has_role(_user,'admin') OR public.has_role(_user,'super_admin')) OR (EXISTS(SELECT 1 FROM public.schools WHERE id=_school AND restrita) AND NOT public.has_role(_user,'super_admin')) THEN RAISE EXCEPTION 'Sem autorização para esta empresa.'; END IF;
SELECT * INTO a FROM public.bank_accounts WHERE id=_account AND school_id=_school FOR UPDATE;
IF a.id IS NULL OR NOT a.ativa OR a.is_virtual THEN RAISE EXCEPTION 'Conta não vinculada à empresa.'; END IF;
code:=public.bank_registered_code(a.banco,a.bank_code);
_identity:=CASE WHEN jsonb_typeof(_identity)='object' THEN _identity ELSE '{}'::jsonb END;
amb:=CASE WHEN jsonb_typeof(_identity->'ambiguousFields')='array' THEN ARRAY(SELECT jsonb_array_elements_text(_identity->'ambiguousFields')) ELSE '{}' END;
IF cardinality(amb)=0 AND coalesce(_identity->>'ambiguous','false')='true' THEN amb:=ARRAY['bankCode','branch','account','holderDocument']; END IF;
r_bank:=CASE WHEN 'bankCode'=ANY(amb) THEN 'uncertain' ELSE public.bank_identity_cmp_bank(_identity->>'bankCode',code) END;
r_branch:=CASE WHEN 'branch'=ANY(amb) THEN 'uncertain' ELSE public.bank_identity_cmp_num(_identity->>'branch',a.agencia) END;
r_acc:=CASE WHEN 'account'=ANY(amb) THEN 'uncertain' ELSE public.bank_identity_cmp_num(_identity->>'account',a.conta) END;
doc:=public.bank_identity_norm(a.holder_document);
IF a.holder_entity_id IS NOT NULL THEN
 SELECT public.bank_identity_norm(e.cnpj) INTO edoc FROM public.company_entities e WHERE e.id=a.holder_entity_id AND e.school_id=a.school_id FOR SHARE;
 IF edoc IS NULL OR edoc='' OR (doc<>'' AND doc<>edoc) THEN conflict:=true; doc:=''; ELSE doc:=edoc; END IF;
END IF;
fdoc:=public.bank_identity_norm(_identity->>'holderDocument');
r_doc:=CASE WHEN 'holderDocument'=ANY(amb) THEN 'uncertain'
 WHEN trim(coalesce(_identity->>'holderDocument',''))='' THEN 'absent'
 WHEN fdoc !~ '^([0-9]{11}|[0-9]{14})$' THEN 'uncertain'
 WHEN coalesce(doc,'') !~ '^([0-9]{11}|[0-9]{14})$' THEN 'missing'
 WHEN fdoc=doc THEN 'match' ELSE 'mismatch' END;
IF r_bank='mismatch' THEN wrong:=wrong||'banco'::text; END IF;
IF r_branch='mismatch' THEN wrong:=wrong||'agência'::text; END IF;
IF r_acc='mismatch' THEN wrong:=wrong||'conta'::text; END IF;
IF r_doc='mismatch' THEN wrong:=wrong||'titular'::text; END IF;
IF cardinality(wrong)>0 THEN RAISE EXCEPTION 'Identidade do extrato diverge do destino: %.', array_to_string(wrong,', '); END IF;
IF code<>'' AND public.bank_identity_norm(a.agencia)<>'' AND public.bank_identity_norm(a.conta)<>'' THEN
 PERFORM pg_advisory_xact_lock_shared(hashtextextended(code||'|'||public.bank_identity_norm(a.agencia)||'|'||public.bank_identity_norm(a.conta),7711442201));
END IF;
shared:=public.bank_account_identity_shared(a.id);
verified:=r_bank='match' AND r_branch='match' AND r_acc='match' AND r_doc IN('match','absent') AND NOT conflict AND NOT shared AND cardinality(amb)=0;
IF jsonb_typeof(_rows) IS DISTINCT FROM 'array' OR jsonb_typeof(_links) IS DISTINCT FROM 'array' OR jsonb_array_length(_rows)>20000 OR coalesce(_meta->>'formato','') NOT IN('ofx','csv','xlsx','pdf') OR coalesce(_meta->>'file_hash','') !~ '^[a-f0-9]{64}$' OR coalesce(_meta->>'file_path','') NOT LIKE _school::text||'/'||_account::text||'/%' THEN RAISE EXCEPTION 'Lote inválido.'; END IF;
total_count:=(_meta->>'total_linhas')::int;
IF total_count IS NULL OR total_count<jsonb_array_length(_rows) THEN RAISE EXCEPTION 'Contagem do lote inválida.'; END IF;
SELECT id INTO iid FROM public.bank_statement_imports WHERE account_id=_account AND file_hash=_meta->>'file_hash'; IF iid IS NOT NULL THEN RAISE EXCEPTION 'Arquivo já importado.'; END IF;
INSERT INTO public.bank_statement_imports(school_id,account_id,file_name,file_path,file_hash,formato,periodo_inicio,periodo_fim,total_linhas,inseridas,duplicadas,total_entradas,total_saidas,imported_by,saldo_final_informado,saldo_aplicado_informado,saldo_retido_informado,identity_checked,identity_status) VALUES(_school,_account,_meta->>'file_name',_meta->>'file_path',_meta->>'file_hash',_meta->>'formato',_meta->>'periodo_inicio',_meta->>'periodo_fim',total_count,jsonb_array_length(_rows),(_meta->>'duplicadas')::int,(_meta->>'total_entradas')::numeric,(_meta->>'total_saidas')::numeric,_user,(_meta->>'saldo_final_informado')::numeric,(_meta->>'saldo_aplicado_informado')::numeric,(_meta->>'saldo_retido_informado')::numeric,verified,CASE WHEN verified THEN 'verified' ELSE 'inconclusive' END) RETURNING id INTO iid;
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
REVOKE ALL ON FUNCTION public.commit_verified_bank_import(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_verified_bank_import(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb) TO service_role;