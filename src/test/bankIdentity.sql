-- Execute only with the disposable local runner below; all identities are fictitious.
CREATE TABLE public.schools(id uuid PRIMARY KEY, restrita boolean DEFAULT false);
CREATE TABLE public.bank_accounts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid,nome text,banco text,agencia text,conta text,ativa boolean DEFAULT true,is_virtual boolean DEFAULT false);
CREATE TABLE public.bank_statement_imports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid,account_id uuid,file_name text,file_path text,file_hash text,formato text,periodo_inicio text,periodo_fim text,total_linhas int,inseridas int,duplicadas int,total_entradas numeric,total_saidas numeric,imported_by uuid,saldo_final_informado numeric,saldo_aplicado_informado numeric,saldo_retido_informado numeric,UNIQUE(account_id,file_hash));
CREATE TABLE public.bank_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid,account_id uuid,import_id uuid,data text,descricao text,valor numeric CHECK(valor>=0),tipo text CHECK(tipo IN('entrada','saida')),bank_ref text,dedup_hash text,movement_kind text,is_forecast boolean,manual_pair_id uuid,UNIQUE(account_id,dedup_hash));
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.role',true) $$;
CREATE FUNCTION public.has_role(u uuid,r text) RETURNS boolean LANGUAGE sql AS $$ SELECT u='00000000-0000-0000-0000-000000000001'::uuid AND r='admin' $$;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT public.has_role(auth.uid(),'admin') $$;
CREATE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION public.can_see_school(s uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT NOT restrita FROM public.schools WHERE id=s $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
\ir ../../drizzle/migrations/0114_bank_import_identity_guard.sql
SELECT set_config('test.role','service_role',false),set_config('test.uid','00000000-0000-0000-0000-000000000001',false);
INSERT INTO schools VALUES('10000000-0000-0000-0000-000000000001',false),('10000000-0000-0000-0000-000000000002',true);
INSERT INTO bank_accounts(id,school_id,nome,banco,agencia,conta,bank_code,identity_verified,holder_document) VALUES('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Fictícia','Banco fictício','0123','0012345-6','237',true,'00000000000000');
CREATE FUNCTION test_commit(i jsonb,rows jsonb DEFAULT '[]',school uuid DEFAULT '10000000-0000-0000-0000-000000000001',usr uuid DEFAULT '00000000-0000-0000-0000-000000000001') RETURNS uuid LANGUAGE sql AS $$ SELECT commit_verified_bank_import(usr,school,'20000000-0000-0000-0000-000000000001',i,jsonb_build_object('file_name','ficticio.ofx','file_hash',repeat('a',64),'file_path',school::text||'/20000000-0000-0000-0000-000000000001/ficticio.ofx','formato','ofx','total_linhas',jsonb_array_length(rows),'duplicadas',0,'total_entradas',10,'total_saidas',0),rows,'[]') $$;
DO $$ DECLARE i jsonb:='{"bankCode":"237","branch":"0123","account":"00123456"}'; n int:=0; BEGIN
 BEGIN PERFORM test_commit(i||'{"bankCode":"748"}'); RAISE EXCEPTION 'TEST FAILED bank'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 BEGIN PERFORM test_commit(i||'{"account":"00123457"}'); RAISE EXCEPTION 'TEST FAILED account'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 BEGIN PERFORM test_commit(i,'[]','10000000-0000-0000-0000-000000000002'); RAISE EXCEPTION 'TEST FAILED school'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 BEGIN PERFORM test_commit(i||'{"holderDocument":"11111111111111"}'); RAISE EXCEPTION 'TEST FAILED holder'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 BEGIN PERFORM test_commit('{}'); RAISE EXCEPTION 'TEST FAILED missing'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 BEGIN PERFORM test_commit(i,'[]','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000099'); RAISE EXCEPTION 'TEST FAILED permission'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 PERFORM set_config('test.role','authenticated',false);
 BEGIN PERFORM test_commit(i); RAISE EXCEPTION 'TEST FAILED service only'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 IF has_function_privilege('authenticated','commit_verified_bank_import(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'TEST FAILED grant'; END IF; n:=n+1;
 BEGIN INSERT INTO bank_statement_imports(school_id,account_id,file_path,total_linhas) VALUES('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ficticio',1); RAISE EXCEPTION 'TEST FAILED bypass'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 PERFORM set_config('test.role','service_role',false);
 BEGIN PERFORM test_commit(i,'[{"data":"2026-11-10","descricao":"ficticio","valor":10,"tipo":"entrada","dedup_hash":"x"},{"data":"2026-11-10","descricao":"ficticio","valor":-1,"tipo":"saida","dedup_hash":"y"}]'); RAISE EXCEPTION 'TEST FAILED late failure'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 IF EXISTS(SELECT 1 FROM bank_statement_imports) OR EXISTS(SELECT 1 FROM bank_transactions) THEN RAISE EXCEPTION 'TEST FAILED partial effects'; END IF; n:=n+1;
 PERFORM test_commit(i||'{"branch":"01.23","account":"00.12345-6"}','[{"data":"2026-11-10","descricao":"ficticio","valor":10,"tipo":"entrada","dedup_hash":"x"}]');
 IF (SELECT count(*) FROM bank_transactions)<>1 OR (SELECT count(*) FROM bank_statement_imports WHERE identity_checked)<>1 THEN RAISE EXCEPTION 'TEST FAILED valid'; END IF; n:=n+1;
 BEGIN PERFORM test_commit(i); RAISE EXCEPTION 'TEST FAILED duplicate'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 IF (SELECT count(*) FROM bank_transactions)<>1 THEN RAISE EXCEPTION 'TEST FAILED duplicate changed rows'; END IF; n:=n+1;
 RAISE NOTICE '% SQL assertions passed (minimal synthetic schema; authorization predicates stubbed)',n;
END $$;