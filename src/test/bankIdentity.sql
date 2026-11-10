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
CREATE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.super',true)='true' $$;
CREATE FUNCTION public.can_see_school(s uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT NOT restrita FROM public.schools WHERE id=s $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA storage;
CREATE TABLE storage.objects(bucket_id text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY legacy_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(true);
CREATE TABLE company_entities(id uuid PRIMARY KEY, school_id uuid, cnpj text);
\ir ../../drizzle/migrations/0114_bank_import_identity_guard.sql
\ir ../../drizzle/migrations/0115_bank_identity_unique_and_storage_gate.sql
\ir ../../drizzle/migrations/0116_bank_identity_controlled_transition.sql
\ir ../../drizzle/migrations/0117_bank_guard_activation_fail_closed.sql
\ir ../../drizzle/migrations/0118_bank_file_import_batch_commit.sql
-- Candidate DDL can be supplied to the local runner before applying a real migration.
\if :{?batch_migration}
\i :batch_migration
\endif
SELECT set_config('test.role','service_role',false),set_config('test.uid','00000000-0000-0000-0000-000000000001',false);
INSERT INTO schools VALUES('10000000-0000-0000-0000-000000000001',false),('10000000-0000-0000-0000-000000000002',true);
INSERT INTO bank_accounts(id,school_id,nome,banco,agencia,conta,bank_code,identity_verified,holder_document) VALUES('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Fictícia','Banco fictício','0123','0012345-6','237',true,'00000000000000');
CREATE FUNCTION test_commit(i jsonb,rows jsonb DEFAULT '[]',school uuid DEFAULT '10000000-0000-0000-0000-000000000001',usr uuid DEFAULT '00000000-0000-0000-0000-000000000001') RETURNS uuid LANGUAGE sql AS $$ SELECT commit_verified_bank_import(usr,school,'20000000-0000-0000-0000-000000000001',i,jsonb_build_object('file_name','ficticio.ofx','file_hash',repeat('a',64),'file_path',school::text||'/20000000-0000-0000-0000-000000000001/ficticio.ofx','formato','ofx','total_linhas',jsonb_array_length(rows),'duplicadas',0,'total_entradas',10,'total_saidas',0),rows,'[]') $$;
DO $$ DECLARE i jsonb:='{"bankCode":"237","branch":"0123","account":"00123456"}'; n int:=0; BEGIN
 IF bank_import_guard_enforced() THEN RAISE EXCEPTION 'TEST FAILED transition default'; END IF;
 PERFORM set_config('test.role','authenticated',false);
 INSERT INTO bank_statement_imports(school_id,account_id,file_path,total_linhas,file_hash) VALUES('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','legacy',1,'legacy');
 DELETE FROM bank_statement_imports WHERE file_hash='legacy';
 BEGIN PERFORM set_bank_import_guard_enforced(true); RAISE EXCEPTION 'TEST FAILED activation unauthorized'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END;
 INSERT INTO bank_import_guard_settings VALUES(true,true);
 UPDATE bank_accounts SET identity_verified=false,bank_code=NULL,banco='Bradesco';
 PERFORM set_config('test.role','service_role',false);
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
DO $$ DECLARE n int:=0; i jsonb:='{"bankCode":"237","branch":"0123","account":"00123456"}'; BEGIN
 IF bank_registered_code('Bradesco',NULL)<>'237' OR bank_registered_code('Sicredi',NULL)<>'748' OR bank_registered_code('Itaú',NULL)<>'341' OR bank_registered_code('Banco inventado',NULL)<>'' OR bank_registered_code('Sicredi','237')<>'' THEN RAISE EXCEPTION 'TEST FAILED aliases'; END IF; n:=n+1;
 BEGIN INSERT INTO bank_accounts(school_id,nome,banco,agencia,conta) VALUES('10000000-0000-0000-0000-000000000002','Fictícia duplicada','Banco Bradesco','01.23','00.12345-6'); RAISE EXCEPTION 'TEST FAILED duplicate registered'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 INSERT INTO company_entities VALUES('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000000000'),('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','11111111111111'),('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','22222222222222');
 UPDATE bank_accounts SET holder_entity_id='30000000-0000-0000-0000-000000000001',holder_document=NULL WHERE id='20000000-0000-0000-0000-000000000001';
 BEGIN UPDATE bank_accounts SET holder_entity_id='30000000-0000-0000-0000-000000000003'; RAISE EXCEPTION 'TEST FAILED cross-company entity'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 BEGIN PERFORM test_commit(i||'{"holderDocument":"11111111111111"}'); RAISE EXCEPTION 'TEST FAILED any company CNPJ'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 DELETE FROM bank_transactions WHERE dedup_hash='x'; DELETE FROM bank_statement_imports WHERE file_hash=repeat('a',64);
 PERFORM test_commit(i||'{"holderDocument":"00000000000000"}'); n:=n+1;
 IF NOT EXISTS(SELECT 1 FROM bank_statement_imports WHERE identity_checked) THEN RAISE EXCEPTION 'TEST FAILED entity accepted'; END IF; n:=n+1;
 PERFORM set_config('test.super','true',false); PERFORM set_bank_import_guard_enforced(false);
 IF bank_import_guard_enforced() THEN RAISE EXCEPTION 'TEST FAILED authorized disable'; END IF; n:=n+1;
 PERFORM set_bank_import_guard_enforced(true); IF NOT bank_import_guard_enforced() THEN RAISE EXCEPTION 'TEST FAILED authorized activate'; END IF; n:=n+1;
 PERFORM set_config('test.super','false',false);
 IF NOT has_function_privilege('authenticated','set_bank_import_guard_enforced(boolean)','EXECUTE') OR has_function_privilege('anon','set_bank_import_guard_enforced(boolean)','EXECUTE') THEN RAISE EXCEPTION 'TEST FAILED activation grants'; END IF; n:=n+1;
 RAISE NOTICE '% additional SQL assertions passed (aliases, account-specific entities, activation)',n;
END $$;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT INSERT ON storage.objects TO authenticated;
SELECT set_config('test.role','authenticated',false);
INSERT INTO bank_import_guard_settings VALUES(true,false) ON CONFLICT(singleton) DO UPDATE SET enforced=false;
SET ROLE authenticated;
INSERT INTO storage.objects VALUES('bank-statements');
RESET ROLE;
UPDATE bank_import_guard_settings SET enforced=true;
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN INSERT INTO storage.objects VALUES('bank-statements'); RAISE EXCEPTION 'TEST FAILED storage activation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO storage.objects VALUES('another-bucket');
 RAISE NOTICE '3 storage policy assertions passed (legacy allowed, full gate blocks, unrelated bucket preserved)';
END $$;
RESET ROLE;