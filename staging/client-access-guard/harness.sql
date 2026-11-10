CREATE SCHEMA t;
CREATE TABLE t.res (n serial, fase text, nome text, esperado text, obtido text, ok boolean);
-- Executa q como papel/usuário fictício; devolve valor (texto) ou 'NEGADO:<sqlstate>'.
CREATE FUNCTION t.try(_uid text, _role text, _q text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(_uid,''), true);
  EXECUTE format('SET LOCAL ROLE %I', _role);
  EXECUTE _q INTO v;
  RESET ROLE; PERFORM set_config('request.jwt.claim.sub','',true);
  RETURN coalesce(v,'<null>');
EXCEPTION WHEN OTHERS THEN
  RETURN 'NEGADO:'||SQLSTATE;
END $$;
CREATE FUNCTION t.chk(_fase text, _nome text, _got text, _exp text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO t.res(fase,nome,esperado,obtido,ok) VALUES (_fase,_nome,_exp,_got,
    CASE WHEN _exp='NEGADO' THEN _got LIKE 'NEGADO:%' WHEN _exp='PERMITIDO' THEN _got NOT LIKE 'NEGADO:%' ELSE _got=_exp END) $$;
-- Dados fictícios
INSERT INTO public.schools VALUES ('00000000-0000-0000-0000-0000000000a1','Escola Teste A',false,true),
 ('00000000-0000-0000-0000-0000000000b1','Escola Teste B',false,true),('00000000-0000-0000-0000-0000000000c1','Escola Restrita C',true,true);
INSERT INTO public.profiles(user_id,email,school_id,admin_scope) VALUES
 ('00000000-0000-0000-0000-000000000010','super@exemplo.test',NULL,'all'),
 ('00000000-0000-0000-0000-000000000011','gestora.a@exemplo.test',NULL,'own'),
 ('00000000-0000-0000-0000-000000000013','apoio@exemplo.test',NULL,'own'),
 ('00000000-0000-0000-0000-000000000014','fora.grupo@exemplo.test',NULL,'own'),
 ('00000000-0000-0000-0000-000000000015','adm.modulo@exemplo.test',NULL,'own'),
 ('00000000-0000-0000-0000-000000000016','cliente@exemplo.test','00000000-0000-0000-0000-0000000000a1','own'),
 ('00000000-0000-0000-0000-000000000017','desligada@exemplo.test',NULL,'own');
INSERT INTO public.user_roles VALUES ('00000000-0000-0000-0000-000000000010','super_admin'),('00000000-0000-0000-0000-000000000011','admin'),
 ('00000000-0000-0000-0000-000000000013','admin'),('00000000-0000-0000-0000-000000000014','admin'),('00000000-0000-0000-0000-000000000015','admin'),
 ('00000000-0000-0000-0000-000000000016','cliente');
-- 17 = desligada: tinha apoio e carteira A, papel admin removido (revogada)
INSERT INTO public.user_schools VALUES ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-0000000000b1'),('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-000000000017','00000000-0000-0000-0000-0000000000a1');
