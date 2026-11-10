-- Synthetic extension to the minimal schema. No production connection.
CREATE TABLE test_statement_calls(kind text);
CREATE FUNCTION test_bank_statement_call() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO test_statement_calls VALUES(TG_OP); RETURN NULL; END $$;
CREATE TRIGGER test_statement_insert AFTER INSERT ON bank_transactions FOR EACH STATEMENT EXECUTE FUNCTION test_bank_statement_call();
CREATE TRIGGER test_statement_update AFTER UPDATE ON bank_transactions FOR EACH STATEMENT EXECUTE FUNCTION test_bank_statement_call();
CREATE FUNCTION test_batch(hash text, rows jsonb, links jsonb DEFAULT '[]') RETURNS uuid LANGUAGE sql AS $$
 SELECT commit_verified_bank_import('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','{"bankCode":"237","branch":"0123","account":"00123456"}',jsonb_build_object('file_name','synthetic.ofx','file_hash',hash,'file_path','10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/synthetic.ofx','formato','ofx','total_linhas',jsonb_array_length(rows),'duplicadas',0),rows,links)
$$;
SELECT set_config('test.role','service_role',false);
DO $$ DECLARE iid uuid; n int:=0; before_count int; before_imports int; BEGIN
 iid:=test_batch(repeat('b',64),'[{"data":"2026-11-10","descricao":"Fictício 1","valor":10,"tipo":"entrada","dedup_hash":"batch1"},{"data":"2026-11-10","descricao":"Fictício 2","valor":20,"tipo":"entrada","dedup_hash":"batch2"}]');
 IF (SELECT count(*) FROM test_statement_calls WHERE kind='INSERT')<>1 THEN RAISE EXCEPTION 'TEST FAILED batch must fire INSERT statement trigger once'; END IF; n:=n+1;
 iid:=test_batch(repeat('c',64),'[{"data":"2026-11-10","descricao":"Fictício 1","valor":10,"tipo":"entrada","dedup_hash":"batch1"},{"data":"2026-11-10","descricao":"Fictício 3","valor":30,"tipo":"entrada","dedup_hash":"batch3"}]');
 IF NOT EXISTS(SELECT 1 FROM bank_statement_imports WHERE id=iid AND inseridas=1 AND duplicadas=1) THEN RAISE EXCEPTION 'TEST FAILED overlapping counts'; END IF; n:=n+1;
 before_count:=(SELECT count(*) FROM bank_transactions); before_imports:=(SELECT count(*) FROM bank_statement_imports);
 BEGIN PERFORM test_batch(repeat('d',64),'[{"data":"2026-11-10","descricao":"Fictício válido","valor":10,"tipo":"entrada","dedup_hash":"rollback1"},{"data":"2026-11-10","descricao":"Fictício inválido","valor":-1,"tipo":"saida","dedup_hash":"rollback2"}]'); RAISE EXCEPTION 'TEST FAILED rollback rejection'; EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT count(*) FROM bank_transactions)<>before_count OR (SELECT count(*) FROM bank_statement_imports)<>before_imports THEN RAISE EXCEPTION 'TEST FAILED batch rollback'; END IF; n:=n+1;
 INSERT INTO bank_accounts(id,school_id,nome) VALUES('20000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','Caixa fictício');
 UPDATE bank_accounts SET nome='Caixa editado' WHERE id='20000000-0000-0000-0000-000000000009';
 IF NOT EXISTS(SELECT 1 FROM bank_accounts WHERE id='20000000-0000-0000-0000-000000000009' AND nome='Caixa editado' AND agencia IS NULL AND conta IS NULL) THEN RAISE EXCEPTION 'TEST FAILED incomplete cash edit'; END IF; n:=n+1;
 -- Owner rule 2026-11-10: incomplete registration warns (inconclusive) instead of blocking the previous routine.
 PERFORM commit_verified_bank_import('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000009','{}',jsonb_build_object('file_name','caixa.xlsx','file_hash',repeat('9',64),'file_path','10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000009/caixa.xlsx','formato','xlsx','total_linhas',0,'duplicadas',0),'[]','[]');
 IF NOT EXISTS(SELECT 1 FROM bank_statement_imports WHERE file_hash=repeat('9',64) AND NOT identity_checked AND identity_status='inconclusive') THEN RAISE EXCEPTION 'TEST FAILED incomplete cash import allowed with warning'; END IF; n:=n+1;
 BEGIN UPDATE bank_accounts SET banco='Sicredi',bank_code='237' WHERE id='20000000-0000-0000-0000-000000000009'; RAISE EXCEPTION 'TEST FAILED incompatible alias'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Código do banco inválido ou incompatível.' THEN RAISE; END IF; END; n:=n+1;
 UPDATE bank_transactions SET bank_ref='old' WHERE dedup_hash='batch1';
 PERFORM test_batch(repeat('e',64),'[]',jsonb_build_array(jsonb_build_object('id',(SELECT id FROM bank_transactions WHERE dedup_hash='batch1'),'bankRef','new','replace',true)));
 IF (SELECT bank_ref FROM bank_transactions WHERE dedup_hash='batch1')<>'old' THEN RAISE EXCEPTION 'TEST FAILED blind replacement'; END IF; n:=n+1;
 PERFORM test_batch(repeat('f',64),'[]',jsonb_build_array(jsonb_build_object('id',(SELECT id FROM bank_transactions WHERE dedup_hash='batch1'),'bankRef','new','replace',true,'expectedBankRef','old')));
 IF (SELECT bank_ref FROM bank_transactions WHERE dedup_hash='batch1')<>'new' THEN RAISE EXCEPTION 'TEST FAILED compare and set'; END IF; n:=n+1;
 PERFORM test_batch(repeat('1',64),'[]',jsonb_build_array(jsonb_build_object('id',(SELECT id FROM bank_transactions WHERE dedup_hash='batch1'),'bankRef','stale','replace',true,'expectedBankRef','old')));
 IF (SELECT bank_ref FROM bank_transactions WHERE dedup_hash='batch1')<>'new' THEN RAISE EXCEPTION 'TEST FAILED stale replacement'; END IF; n:=n+1;
 INSERT INTO bank_accounts(id,school_id,nome,banco,agencia,conta) VALUES('20000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000002','Outro destino fictício','Inter','0001','0001111-1');
 INSERT INTO bank_statement_imports(id,school_id,account_id,file_hash) VALUES('40000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000008','synthetic');
 INSERT INTO bank_transactions(id,school_id,account_id,import_id,data,valor,tipo,dedup_hash) VALUES('50000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000008','40000000-0000-0000-0000-000000000008','2026-11-10',1,'entrada','foreign');
 PERFORM test_batch(repeat('2',64),'[]','[{"id":"50000000-0000-0000-0000-000000000008","bankRef":"forbidden"}]');
 IF (SELECT bank_ref FROM bank_transactions WHERE id='50000000-0000-0000-0000-000000000008') IS NOT NULL THEN RAISE EXCEPTION 'TEST FAILED cross destination reference'; END IF; n:=n+1;
 PERFORM test_batch(repeat('3',64),'[]',jsonb_build_array(jsonb_build_object('id',(SELECT id FROM bank_transactions WHERE dedup_hash='batch2'),'bankRef','one'),jsonb_build_object('id',(SELECT id FROM bank_transactions WHERE dedup_hash='batch2'),'bankRef','two')));
 IF (SELECT bank_ref FROM bank_transactions WHERE dedup_hash='batch2') IS NOT NULL THEN RAISE EXCEPTION 'TEST FAILED duplicate reference targets'; END IF; n:=n+1;
 DELETE FROM test_statement_calls;
 PERFORM test_batch(repeat('4',64),(SELECT jsonb_agg(jsonb_build_object('data','2026-11-10','descricao','Sintético','valor',1,'tipo','entrada','dedup_hash','large-'||g)) FROM generate_series(1,2000) g));
 IF (SELECT count(*) FROM test_statement_calls WHERE kind='INSERT')<>1 OR (SELECT count(*) FROM bank_transactions WHERE dedup_hash LIKE 'large-%')<>2000 THEN RAISE EXCEPTION 'TEST FAILED large batch'; END IF; n:=n+1;
 RAISE NOTICE '% batch SQL assertions passed',n;
END $$;