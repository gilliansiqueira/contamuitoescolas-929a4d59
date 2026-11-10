-- Testes contra o schema COMPLETO reconstruído das migrations do repositório (banco descartável, só dados fictícios).
\set ON_ERROR_STOP 1
CREATE TEMP TABLE r(name text, ok boolean); GRANT ALL ON r TO PUBLIC;
CREATE FUNCTION pg_temp.h(t text) RETURNS text LANGUAGE sql AS $$ SELECT encode(extensions.digest(t,'sha256'),'hex') $$;
CREATE FUNCTION pg_temp.pl(k text, hk text, ini text, fim text, days jsonb, occ jsonb DEFAULT '[]') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('attempt_id',md5(k)::uuid,'content_hash',pg_temp.h(hk),'periodoInicio',ini,'periodoFim',fim,'arquivo','sintetico.pdf',
   'employees','[{"external_id":"pf-1","matricula":"10","nome":"Pessoa Um","cargo":"Aux","departamento":"Adm"}]'::jsonb,'daily',days,'occurrences',occ) $$;
CREATE FUNCTION pg_temp.d(dia text, sit text DEFAULT 'regular', ht text DEFAULT '08:00') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('employee_external_id','pf-1','dia',dia,'horario_previsto','08-17','primeira_marcacao','08:00','ultima_marcacao','17:00','marcacoes',jsonb_build_array('08:00','17:00'),'horas_trabalhadas',ht,'horas_extras',null,'situacao',sit,'ocorrencia',null) $$;
-- Usuários fictícios: um super_admin e um admin comum.
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-0000-0000-0000000000a1','super@exemplo.test'),('00000000-0000-0000-0000-0000000000b2','comum@exemplo.test');
INSERT INTO public.user_roles(user_id,role) VALUES ('00000000-0000-0000-0000-0000000000a1','super_admin'),('00000000-0000-0000-0000-0000000000b2','admin');
INSERT INTO public.team_time_employees(external_id,nome,user_id,oculto,desligado_em,horario_override) VALUES ('pf-1','Nome Antigo','00000000-0000-0000-0000-0000000000b2',true,'2030-12-31','09:00-18:00');
INSERT INTO public.team_time_daily(employee_external_id,dia,situacao,horas_trabalhadas) VALUES ('pf-1','2029-12-15','regular','07:00'),('pf-1','2030-01-05','regular','06:00');
INSERT INTO public.team_time_justifications(employee_external_id,dia,motivo,status,criado_por) VALUES ('pf-1','2030-01-02','médico','aceita','00000000-0000-0000-0000-0000000000b2');
INSERT INTO public.team_time_daily_overrides(employee_external_id,dia,batidas_ignoradas) VALUES ('pf-1','2030-01-02','{"08:05"}');
INSERT INTO public.team_time_occurrences(external_key,employee_external_id,dia,tipo,origem) VALUES ('api|pf-1|2030-01-02','pf-1','2030-01-02','Atestado','ocorrencias');

-- 1) Acesso à função de gravação
DO $$ BEGIN SET LOCAL ROLE authenticated; PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
  BEGIN PERFORM public.team_time_import_report('{}'); INSERT INTO r VALUES ('authenticated (mesmo super_admin) não executa a RPC',false); EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; INSERT INTO r VALUES ('authenticated (mesmo super_admin) não executa a RPC',true); END; RESET ROLE; END $$;
DO $$ BEGIN SET LOCAL ROLE anon; BEGIN PERFORM public.team_time_import_report('{}'); INSERT INTO r VALUES ('anon não executa a RPC',false); EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; INSERT INTO r VALUES ('anon não executa a RPC',true); END; RESET ROLE; END $$;

-- 2) Falha tardia desfaz tudo (gatilho aborta o registro final)
CREATE TEMP TABLE snap AS SELECT (SELECT count(*) FROM public.team_time_daily) d,(SELECT count(*) FROM public.team_time_occurrences) o,(SELECT nome FROM public.team_time_employees WHERE external_id='pf-1') n;
CREATE FUNCTION pg_temp.boom() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha tardia simulada'; END $$;
CREATE TRIGGER boom BEFORE INSERT ON public.team_time_sync_runs FOR EACH ROW EXECUTE FUNCTION pg_temp.boom();
DO $$ BEGIN BEGIN SET LOCAL ROLE service_role; PERFORM public.team_time_import_report(pg_temp.pl('late','late','2030-01-01','2030-01-03',jsonb_build_array(pg_temp.d('2030-01-01'),pg_temp.d('2030-01-02','falta')))); EXCEPTION WHEN others THEN NULL; END; RESET ROLE; END $$;
DROP TRIGGER boom ON public.team_time_sync_runs;
INSERT INTO r SELECT 'falha tardia não deixa nada gravado', (SELECT count(*) FROM public.team_time_daily)=s.d AND (SELECT count(*) FROM public.team_time_occurrences)=s.o AND (SELECT nome FROM public.team_time_employees WHERE external_id='pf-1')=s.n FROM snap s;

-- 3) Gravação A, repetição da mesma tentativa, conflito, A->B->A
SET ROLE service_role;
SELECT public.team_time_import_report(pg_temp.pl('A1','A','2030-01-01','2030-01-03',jsonb_build_array(pg_temp.d('2030-01-01'),pg_temp.d('2030-01-02')))) \gset a_
RESET ROLE;
INSERT INTO r SELECT 'A grava 2 dias', (SELECT count(*) FROM public.team_time_daily WHERE dia BETWEEN '2030-01-01' AND '2030-01-03')=2;
CREATE TEMP TABLE ids AS SELECT id, dia FROM public.team_time_daily WHERE dia BETWEEN '2030-01-01' AND '2030-01-03';
SET ROLE service_role;
INSERT INTO r SELECT 'mesma tentativa = replay', (public.team_time_import_report(pg_temp.pl('A1','A','2030-01-01','2030-01-03',jsonb_build_array(pg_temp.d('2030-01-01'),pg_temp.d('2030-01-02')))))->>'replay'='true';
DO $$ BEGIN BEGIN PERFORM public.team_time_import_report(pg_temp.pl('A1','OUTRO','2030-01-01','2030-01-03',jsonb_build_array(pg_temp.d('2030-01-01')))); INSERT INTO r VALUES ('mesma tentativa com outro conteúdo recusada',false); EXCEPTION WHEN raise_exception THEN INSERT INTO r VALUES ('mesma tentativa com outro conteúdo recusada',true); END; END $$;
SELECT public.team_time_import_report(pg_temp.pl('B1','B','2030-01-01','2030-01-03',jsonb_build_array(pg_temp.d('2030-01-01','regular','07:30'),pg_temp.d('2030-01-02')))) \gset b_
INSERT INTO r SELECT 'correção B aplicada', (SELECT horas_trabalhadas FROM public.team_time_daily WHERE dia='2030-01-01')='07:30';
SELECT public.team_time_import_report(pg_temp.pl('A2','A','2030-01-01','2030-01-03',jsonb_build_array(pg_temp.d('2030-01-01'),pg_temp.d('2030-01-02')))) \gset c_
RESET ROLE;
INSERT INTO r SELECT 'A->B->A reaplica A com tentativa nova', (SELECT horas_trabalhadas FROM public.team_time_daily WHERE dia='2030-01-01')='08:00';
INSERT INTO r SELECT 'IDs dos dias mantidos (sem apagar/recriar)', NOT EXISTS (SELECT 1 FROM ids i LEFT JOIN public.team_time_daily t USING(id) WHERE t.id IS NULL);
INSERT INTO r SELECT 'sem dias duplicados', NOT EXISTS (SELECT 1 FROM public.team_time_daily GROUP BY employee_external_id,dia HAVING count(*)>1);

-- 4) Dias ausentes e campos preservados
INSERT INTO r SELECT 'dia fora do relatório preservado (2030-01-05)', (SELECT horas_trabalhadas FROM public.team_time_daily WHERE dia='2030-01-05')='06:00';
INSERT INTO r SELECT 'histórico antigo preservado', EXISTS (SELECT 1 FROM public.team_time_daily WHERE dia='2029-12-15');
INSERT INTO r SELECT 'vínculo, oculto, desligamento e horário corrigido preservados', (SELECT user_id='00000000-0000-0000-0000-0000000000b2' AND oculto AND desligado_em='2030-12-31' AND horario_override='09:00-18:00' FROM public.team_time_employees WHERE external_id='pf-1');
INSERT INTO r SELECT 'justificativa aceita preservada', (SELECT status FROM public.team_time_justifications WHERE dia='2030-01-02')='aceita';
INSERT INTO r SELECT 'batidas ignoradas preservadas', (SELECT batidas_ignoradas FROM public.team_time_daily_overrides WHERE dia='2030-01-02')='{"08:05"}';
INSERT INTO r SELECT 'ocorrência de outra origem preservada', EXISTS (SELECT 1 FROM public.team_time_occurrences WHERE external_key='api|pf-1|2030-01-02');

-- 5) Leitura pelas regras reais de acesso (RLS do schema completo)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
CREATE TEMP TABLE x1 AS SELECT count(*) c FROM public.team_time_daily;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b2',false);
CREATE TEMP TABLE x2 AS SELECT count(*) c FROM public.team_time_daily WHERE employee_external_id<>'pf-1';
CREATE TEMP TABLE x3 AS SELECT count(*) c FROM public.team_time_sync_runs;
DO $$ BEGIN BEGIN INSERT INTO public.team_time_daily(employee_external_id,dia) VALUES ('pf-1','2031-01-01'); INSERT INTO r VALUES ('admin comum não grava direto no ponto',false); EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('admin comum não grava direto no ponto',true); END; END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false);
INSERT INTO r SELECT 'super_admin lê o ponto pela regra real', (SELECT c FROM x1)>0;
INSERT INTO r SELECT 'admin comum não lê ponto de outras pessoas nem execuções', (SELECT c FROM x2)=0 AND (SELECT c FROM x3)=0;
SELECT (CASE WHEN ok THEN 'OK   ' ELSE 'FALHA' END)||' '||name FROM r;
SELECT count(*) FILTER (WHERE ok)||'/'||count(*) AS resultado FROM r;
