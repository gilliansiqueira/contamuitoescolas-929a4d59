-- Execute only with the disposable local runner (bankIdentity.integration.sh); all identities are fictitious.
-- Owner rule 2026-11-10: block only concrete header × registration divergences or wrong company/account/permission.
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
-- The applied migration, or a candidate file supplied by the runner before applying it.
\if :{?batch_migration}
\i :batch_migration
\else
\ir ../../drizzle/migrations/0119_bank_identity_warn_not_block.sql
\endif
SELECT set_config('test.role','service_role',false),set_config('test.uid','00000000-0000-0000-0000-000000000001',false);
INSERT INTO schools VALUES('10000000-0000-0000-0000-000000000001',false),('10000000-0000-0000-0000-000000000002',true),('10000000-0000-0000-0000-000000000003',false);
INSERT INTO bank_import_guard_settings VALUES(true,true);
INSERT INTO bank_accounts(id,school_id,nome,banco,agencia,conta) VALUES('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Fictícia Bradesco','Bradesco','0123','0012345-6');
CREATE FUNCTION test_commit(i jsonb,hash text,formato text DEFAULT 'ofx',rows jsonb DEFAULT '[]',school uuid DEFAULT '10000000-0000-0000-0000-000000000001',usr uuid DEFAULT '00000000-0000-0000-0000-000000000001',acc uuid DEFAULT '20000000-0000-0000-0000-000000000001') RETURNS uuid LANGUAGE sql AS $$
 SELECT commit_verified_bank_import(usr,school,acc,i,jsonb_build_object('file_name','ficticio.'||formato,'file_hash',hash,'file_path',school::text||'/'||acc::text||'/ficticio','formato',formato,'total_linhas',jsonb_array_length(rows),'duplicadas',0,'total_entradas',0,'total_saidas',0),rows,'[]') $$;
CREATE FUNCTION test_status(hash text) RETURNS text LANGUAGE sql AS $$ SELECT identity_status||'|'||identity_checked FROM bank_statement_imports WHERE file_hash=hash $$;
CREATE FUNCTION test_blocked(i jsonb,expected text,school uuid DEFAULT '10000000-0000-0000-0000-000000000001',usr uuid DEFAULT '00000000-0000-0000-0000-000000000001',acc uuid DEFAULT '20000000-0000-0000-0000-000000000001') RETURNS void LANGUAGE plpgsql AS $$
DECLARE before_i int:=(SELECT count(*) FROM bank_statement_imports); before_t int:=(SELECT count(*) FROM bank_transactions); BEGIN
 BEGIN PERFORM test_commit(i,repeat('0',64),'ofx','[{"data":"2026-11-10","descricao":"fictício","valor":1,"tipo":"entrada","dedup_hash":"blocked"}]',school,usr,acc); RAISE EXCEPTION 'TEST FAILED accepted: %',expected;
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; IF SQLERRM NOT LIKE '%'||expected||'%' THEN RAISE EXCEPTION 'TEST FAILED wrong reason for %: %',expected,SQLERRM; END IF; END;
 IF (SELECT count(*) FROM bank_statement_imports)<>before_i OR (SELECT count(*) FROM bank_transactions)<>before_t THEN RAISE EXCEPTION 'TEST FAILED partial effects: %',expected; END IF;
END $$;
DO $$ DECLARE n int:=0; ok jsonb:='{"bankCode":"237","branch":"0123","account":"00123456"}'; BEGIN
 -- Concrete divergences: blocked, without any partial effect, even when other fields are missing.
 PERFORM test_blocked('{"bankCode":"748","branch":"0123","account":"00123456"}','banco'); n:=n+1;
 PERFORM test_blocked('{"bankCode":"748"}','banco'); n:=n+1;
 PERFORM test_blocked('{"account":"00123457"}','conta'); n:=n+1;
 PERFORM test_blocked('{"branch":"0999"}','agência'); n:=n+1;
 PERFORM test_blocked('{"bankCode":"237","account":"0012345-X"}','conta'); n:=n+1;
 -- Wrong company / account / permission: blocked.
 PERFORM test_blocked(ok,'Conta não vinculada','10000000-0000-0000-0000-000000000003'); n:=n+1;
 PERFORM test_blocked(ok,'Sem autorização','10000000-0000-0000-0000-000000000002'); n:=n+1;
 PERFORM test_blocked(ok,'Sem autorização','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000099'); n:=n+1;
 -- Missing / partial / unreadable / ambiguous identity: allowed, never marked verified.
 PERFORM test_commit('{}',repeat('a',64),'pdf');
 IF test_status(repeat('a',64))<>'inconclusive|false' THEN RAISE EXCEPTION 'TEST FAILED pdf without identity'; END IF; n:=n+1;
 PERFORM test_commit('{"bankCode":"237"}',repeat('b',64),'xlsx');
 IF test_status(repeat('b',64))<>'inconclusive|false' THEN RAISE EXCEPTION 'TEST FAILED partial identity'; END IF; n:=n+1;
 PERFORM test_commit('{"bankCode":"237","branch":"123","account":"0012345"}',repeat('c',64),'csv');
 IF test_status(repeat('c',64))<>'inconclusive|false' THEN RAISE EXCEPTION 'TEST FAILED missing check digit must be uncertain, not blocked'; END IF; n:=n+1;
 PERFORM test_commit('{"bankCode":"999","branch":"0123","account":"00123456"}',repeat('d',64));
 IF test_status(repeat('d',64))<>'inconclusive|false' THEN RAISE EXCEPTION 'TEST FAILED unknown bank code'; END IF; n:=n+1;
 PERFORM test_commit('{"bankCode":"237","branch":"0123","account":"00123457","ambiguous":true,"ambiguousFields":["account"]}',repeat('e',64));
 IF test_status(repeat('e',64))<>'inconclusive|false' THEN RAISE EXCEPTION 'TEST FAILED ambiguous field'; END IF; n:=n+1;
 PERFORM test_commit(ok||'{"holderDocument":"11111111111111"}',repeat('f',64));
 IF test_status(repeat('f',64))<>'inconclusive|false' THEN RAISE EXCEPTION 'TEST FAILED unregistered holder warns'; END IF; n:=n+1;
 -- Full match: verified; equivalent formatting and leading zeros accepted.
 PERFORM test_commit('{"bankCode":"0237","branch":"01.23","account":"12345-6"}',repeat('1',64),'ofx','[{"data":"2026-11-10","descricao":"fictício","valor":10,"tipo":"entrada","dedup_hash":"x"}]');
 IF test_status(repeat('1',64))<>'verified|true' OR (SELECT count(*) FROM bank_transactions WHERE dedup_hash='x')<>1 THEN RAISE EXCEPTION 'TEST FAILED verified'; END IF; n:=n+1;
 -- Registered holder: mismatch blocks, match verifies.
 UPDATE bank_accounts SET holder_document='00000000000000' WHERE id='20000000-0000-0000-0000-000000000001';
 PERFORM test_blocked(ok||'{"holderDocument":"11111111111111"}','titular'); n:=n+1;
 PERFORM test_commit(ok||'{"holderDocument":"00.000.000/0000-00"}',repeat('2',64));
 IF test_status(repeat('2',64))<>'verified|true' THEN RAISE EXCEPTION 'TEST FAILED holder match'; END IF; n:=n+1;
 UPDATE bank_accounts SET holder_document=NULL WHERE id='20000000-0000-0000-0000-000000000001';
 -- Duplicate registration in another company: saving allowed; import allowed but inconclusive.
 INSERT INTO bank_accounts(id,school_id,nome,banco,agencia,conta) VALUES('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','Duplicada fictícia','Banco Bradesco','01.23','00.12345-6'); n:=n+1;
 IF NOT bank_account_identity_shared('20000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'TEST FAILED shared detection'; END IF;
 PERFORM test_commit(ok,repeat('3',64));
 IF test_status(repeat('3',64))<>'inconclusive|false' THEN RAISE EXCEPTION 'TEST FAILED shared registration warns'; END IF; n:=n+1;
 DELETE FROM bank_accounts WHERE id='20000000-0000-0000-0000-000000000003';
 -- Atomic batch: late failure leaves nothing; duplicate file and invalid format rejected.
 BEGIN PERFORM test_commit(ok,repeat('4',64),'ofx','[{"data":"2026-11-10","descricao":"ok","valor":10,"tipo":"entrada","dedup_hash":"late1"},{"data":"2026-11-10","descricao":"inválido","valor":-1,"tipo":"saida","dedup_hash":"late2"}]'); RAISE EXCEPTION 'TEST FAILED late failure'; EXCEPTION WHEN check_violation THEN NULL; END;
 IF EXISTS(SELECT 1 FROM bank_statement_imports WHERE file_hash=repeat('4',64)) OR EXISTS(SELECT 1 FROM bank_transactions WHERE dedup_hash LIKE 'late%') THEN RAISE EXCEPTION 'TEST FAILED partial late effects'; END IF; n:=n+1;
 BEGIN PERFORM test_commit(ok,repeat('1',64)); RAISE EXCEPTION 'TEST FAILED duplicate file'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Arquivo já importado%' THEN RAISE; END IF; END; n:=n+1;
 BEGIN PERFORM test_commit(ok,repeat('5',64),'docx'); RAISE EXCEPTION 'TEST FAILED format'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Lote inválido.' THEN RAISE; END IF; END; n:=n+1;
 -- Service-only RPC and immutable markers.
 PERFORM set_config('test.role','authenticated',false);
 BEGIN PERFORM test_commit(ok,repeat('6',64)); RAISE EXCEPTION 'TEST FAILED service only'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Acesso não autorizado.' THEN RAISE; END IF; END; n:=n+1;
 IF has_function_privilege('authenticated','commit_verified_bank_import(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb)','EXECUTE') OR has_function_privilege('authenticated','bank_account_identity_shared(uuid)','EXECUTE') THEN RAISE EXCEPTION 'TEST FAILED grants'; END IF; n:=n+1;
 BEGIN INSERT INTO bank_statement_imports(school_id,account_id,file_hash,identity_status,total_linhas) VALUES('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','manual-x','verified',0); RAISE EXCEPTION 'TEST FAILED forged status'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 BEGIN INSERT INTO bank_statement_imports(school_id,account_id,file_path,total_linhas,file_hash) VALUES('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','direto',1,'direto'); RAISE EXCEPTION 'TEST FAILED bypass'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 BEGIN UPDATE bank_statement_imports SET identity_status='verified' WHERE file_hash=repeat('a',64); RAISE EXCEPTION 'TEST FAILED status update'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 PERFORM set_config('test.role','service_role',false);
 -- Registration validation of the optional new fields stays; incomplete cash accounts stay editable.
 BEGIN UPDATE bank_accounts SET banco='Sicredi',bank_code='237' WHERE id='20000000-0000-0000-0000-000000000001'; RAISE EXCEPTION 'TEST FAILED incompatible alias'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END; n:=n+1;
 IF bank_identity_cmp_num('0012345','0012345-6')<>'uncertain' OR bank_identity_cmp_num('00123457','0012345-6')<>'mismatch' OR bank_identity_cmp_num('','1')<>'missing' OR bank_identity_cmp_bank('0748','237')<>'mismatch' OR bank_identity_cmp_bank('136','237')<>'uncertain' OR bank_identity_cmp_bank('136','136')<>'match' THEN RAISE EXCEPTION 'TEST FAILED helpers'; END IF; n:=n+1;
 DELETE FROM bank_transactions; DELETE FROM bank_statement_imports;
 RAISE NOTICE '% SQL assertions passed (minimal synthetic schema; authorization predicates stubbed)',n;
END $$;
