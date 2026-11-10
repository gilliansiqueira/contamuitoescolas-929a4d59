\set SU '''00000000-0000-0000-0000-000000000010'''
\set GA '''00000000-0000-0000-0000-000000000011'''
\set AP '''00000000-0000-0000-0000-000000000013'''
\set FG '''00000000-0000-0000-0000-000000000014'''
\set AM '''00000000-0000-0000-0000-000000000015'''
\set CL '''00000000-0000-0000-0000-000000000016'''
\set DL '''00000000-0000-0000-0000-000000000017'''
-- ===== FASE 1: código ATUAL (migrations 0096–0098 aplicadas sem alteração) =====
SELECT t.try(:GA,'authenticated',$q$SELECT public.save_access_entry(NULL,'00000000-0000-0000-0000-0000000000a1','banco','Banco Ficticio','https://exemplo.test','usuario.teste','Fict1cia!',true,'[{"label":"obs","value":"senha2: Outra#123"}]','senha do token: 9999')::text$q$) AS id1 \gset
SELECT t.chk('atual','gestora cria acesso na própria carteira', :'id1', 'PERMITIDO');
SELECT t.chk('atual','apoio (outra carteira) NÃO consegue usar senha de A [lacuna: apoio impossível]', t.try(:AP,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'id1')), 'NEGADO');
SELECT t.chk('atual','gestora revela', t.try(:GA,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'id1')), 'Fict1cia!');
SELECT t.chk('atual','extras/observação legíveis em claro [lacuna]', t.try(:GA,'authenticated','SELECT observacao FROM public.client_access_entries LIMIT 1'), 'senha do token: 9999');
SELECT t.chk('atual','mesmo poder usa e arquiva [lacuna: sem separação]', t.try(:GA,'authenticated',format('SELECT public.archive_access_entry(%L,false)::text',:'id1')), 'PERMITIDO');
SELECT t.chk('atual','coluna cifrada sem leitura direta', t.try(:GA,'authenticated','SELECT secret_enc::text FROM public.client_access_entries LIMIT 1'), 'NEGADO');
SELECT t.chk('atual','anônimo sem RPC', t.try(NULL,'anon',format('SELECT public.reveal_access_secret(%L)',:'id1')), 'NEGADO');
-- registros da fase 1 apagados antes da proposta (como superusuário de teste)
TRUNCATE public.client_access_entries CASCADE;
