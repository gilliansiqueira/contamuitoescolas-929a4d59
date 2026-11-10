\set ON_ERROR_STOP 1
-- Chaves sintéticas
\set K1 '''aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'''
\set K2 '''bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'''
\set K3 '''cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'''
CREATE TEMP TABLE r(name text, ok boolean);
GRANT ALL ON r TO PUBLIC;
CREATE FUNCTION pl(k text, ini text, fim text, days jsonb, occ jsonb DEFAULT '[]') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('attempt_id',md5(k)::uuid,'content_hash',encode(sha256(convert_to(ini||fim||days::text||occ::text,'UTF8')),'hex'),'periodoInicio',ini,'periodoFim',fim,'arquivo','sintetico.pdf',
   'employees','[{"external_id":"pf-1","matricula":"10","nome":"Pessoa Um","cargo":"Aux","departamento":"Adm"}]'::jsonb,'daily',days,'occurrences',occ) $$;
CREATE FUNCTION d(dia text, sit text DEFAULT 'regular', oc text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('employee_external_id','pf-1','dia',dia,'horario_previsto','08-17','primeira_marcacao','08:00','ultima_marcacao','17:00','marcacoes',jsonb_build_array('08:00','17:00'),'horas_trabalhadas','08:00','horas_extras',null,'situacao',sit,'ocorrencia',oc) $$;

-- Estado prévio: pessoa com campos manuais, histórico antigo, justificativa, ajuste e ocorrência de outra origem.
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO team_time_employees (external_id,nome,user_id,oculto,desligado_em,horario_override) VALUES ('pf-1','Nome Antigo','00000000-0000-0000-0000-000000000001',true,'2030-12-31','09:00-18:00');
INSERT INTO team_time_daily (employee_external_id,dia,situacao,horas_trabalhadas) VALUES ('pf-1','2029-12-15','regular','07:00'),('pf-1','2030-01-05','regular','06:00');
INSERT INTO team_time_justifications (employee_external_id,dia,motivo) VALUES ('pf-1','2030-01-02','médico');
INSERT INTO team_time_daily_overrides (employee_external_id,dia,valor) VALUES ('pf-1','2030-01-02','x');
INSERT INTO team_time_occurrences (external_key,employee_external_id,dia,tipo,origem) VALUES ('api|pf-1|2030-01-02','pf-1','2030-01-02','Atestado','ocorrencias'),('relatorio_pdf|pf-1|2030-01-02|velha','pf-1','2030-01-02','Velha','relatorio_pdf');

-- 1) Acesso: anon/authenticated negados
DO $$ BEGIN SET LOCAL ROLE authenticated; BEGIN PERFORM team_time_import_report('{}'); INSERT INTO r VALUES ('authenticated negado',false); EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; INSERT INTO r VALUES ('authenticated negado',true); END; RESET ROLE; END $$;
DO $$ BEGIN SET LOCAL ROLE anon; BEGIN PERFORM team_time_import_report('{}'); INSERT INTO r VALUES ('anon negado',false); EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; INSERT INTO r VALUES ('anon negado',true); END; RESET ROLE; END $$;

-- 2) Falha tardia: gatilho aborta no último passo (registro da execução) => nada muda
CREATE TEMP TABLE snap AS SELECT (SELECT count(*) FROM team_time_daily) d, (SELECT count(*) FROM team_time_occurrences) o, (SELECT nome FROM team_time_employees) n;
CREATE FUNCTION boom() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha tardia simulada'; END $$;
CREATE TRIGGER boom BEFORE INSERT ON team_time_sync_runs FOR EACH ROW EXECUTE FUNCTION boom();
DO $$ BEGIN BEGIN SET LOCAL ROLE service_role; PERFORM team_time_import_report(pl(repeat('a',64),'2030-01-01','2030-01-03',jsonb_build_array(d('2030-01-01'),d('2030-01-02','falta','Falta')),'[{"external_key":"relatorio_pdf|pf-1|2030-01-02|falta","employee_external_id":"pf-1","dia":"2030-01-02","tipo":"Falta"}]')); EXCEPTION WHEN others THEN NULL; END; RESET ROLE; END $$;
DROP TRIGGER boom ON team_time_sync_runs;
INSERT INTO r SELECT 'falha tardia desfaz tudo', (SELECT count(*) FROM team_time_daily)=s.d AND (SELECT count(*) FROM team_time_occurrences)=s.o AND (SELECT nome FROM team_time_employees)=s.n AND (SELECT count(*) FROM team_time_sync_runs)=0 FROM snap s;

-- 3) Importação 1 (dias 01–03, dia 03 ausente)
SET ROLE service_role;
SELECT team_time_import_report(pl(:K1,'2030-01-01','2030-01-03',jsonb_build_array(d('2030-01-01'),d('2030-01-02','falta','Falta')),'[{"external_key":"relatorio_pdf|pf-1|2030-01-02|falta","employee_external_id":"pf-1","dia":"2030-01-02","tipo":"Falta"}]')) AS imp1 \gset
RESET ROLE;
CREATE TEMP TABLE ids AS SELECT dia, id FROM team_time_daily WHERE dia IN ('2030-01-01','2030-01-02');
INSERT INTO r SELECT 'campos preservados', user_id IS NOT NULL AND oculto AND desligado_em='2030-12-31' AND horario_override='09:00-18:00' AND nome='Pessoa Um' FROM team_time_employees;
INSERT INTO r SELECT 'histórico fora do período preservado', count(*)=2 FROM team_time_daily WHERE dia IN ('2029-12-15','2030-01-05');
INSERT INTO r SELECT 'justificativa e ajuste intactos', (SELECT count(*) FROM team_time_justifications)=1 AND (SELECT count(*) FROM team_time_daily_overrides)=1;
INSERT INTO r SELECT 'ocorrência de outra origem intacta', count(*)=1 FROM team_time_occurrences WHERE origem='ocorrencias';
INSERT INTO r SELECT 'ocorrência PDF antiga do dia trocada', NOT EXISTS (SELECT 1 FROM team_time_occurrences WHERE tipo='Velha') AND EXISTS (SELECT 1 FROM team_time_occurrences WHERE tipo='Falta');

-- 4) Repetição idêntica (timeout após commit) => replay, sem duplicar
SET ROLE service_role;
SELECT team_time_import_report(pl(:K1,'2030-01-01','2030-01-03',jsonb_build_array(d('2030-01-01'),d('2030-01-02','falta','Falta')),'[{"external_key":"relatorio_pdf|pf-1|2030-01-02|falta","employee_external_id":"pf-1","dia":"2030-01-02","tipo":"Falta"}]')) ->> 'replay' AS rep \gset
RESET ROLE;
INSERT INTO r SELECT 'repetição é replay', :'rep'='true' AND (SELECT count(*) FROM team_time_sync_runs WHERE status='success')=1;

-- 5) Sobreposição (reimporta 02–04 com 2–3 dias anteriores; dia 01 ausente)
SET ROLE service_role;
SELECT team_time_import_report(pl(:K2,'2030-01-02','2030-01-04',jsonb_build_array(d('2030-01-02'),d('2030-01-03'),d('2030-01-04')))) AS imp2 \gset
RESET ROLE;
INSERT INTO r SELECT 'sobreposição sem duplicar', (SELECT count(*) FROM team_time_daily WHERE employee_external_id='pf-1' AND dia BETWEEN '2030-01-01' AND '2030-01-04')=4 AND NOT EXISTS (SELECT 1 FROM team_time_daily GROUP BY employee_external_id,dia HAVING count(*)>1);
INSERT INTO r SELECT 'IDs mantidos no upsert', bool_and(t.id=i.id) FROM ids i JOIN team_time_daily t USING (dia);
INSERT INTO r SELECT 'dia ausente preservado', situacao='regular' FROM team_time_daily WHERE dia='2030-01-01';
INSERT INTO r SELECT 'dia relido atualizado e ocorrência PDF removida', (SELECT situacao FROM team_time_daily WHERE dia='2030-01-02')='regular' AND NOT EXISTS (SELECT 1 FROM team_time_occurrences WHERE origem='relatorio_pdf');

-- 6) Defensivo no servidor: dia fora do período / repetido
SET ROLE service_role;
DO $$ BEGIN BEGIN PERFORM team_time_import_report(pl(repeat('c',64),'2030-01-01','2030-01-02',jsonb_build_array(d('2030-01-09')))); INSERT INTO r VALUES ('rejeita dia fora',false); EXCEPTION WHEN others THEN INSERT INTO r VALUES ('rejeita dia fora',true); END; END $$;
DO $$ BEGIN BEGIN PERFORM team_time_import_report(pl(repeat('c',64),'2030-01-01','2030-01-02',jsonb_build_array(d('2030-01-01'),d('2030-01-01')))); INSERT INTO r VALUES ('rejeita dia repetido',false); EXCEPTION WHEN others THEN INSERT INTO r VALUES ('rejeita dia repetido',true); END; END $$;
DO $$ BEGIN BEGIN PERFORM team_time_import_report(pl('cpf','2030-01-01','2030-01-02','[]') || '{"cpf":"x"}'); INSERT INTO r VALUES ('rejeita campo cpf',false); EXCEPTION WHEN others THEN INSERT INTO r VALUES ('rejeita campo cpf',true); END; END $$;
-- 7) Mesma tentativa com conteúdo diferente => rejeitada
DO $$ BEGIN BEGIN PERFORM team_time_import_report(pl(repeat('a',64),'2030-01-01','2030-01-03',jsonb_build_array(d('2030-01-01','falta','X')))); INSERT INTO r VALUES ('mesma tentativa, conteúdo diferente: rejeita',false); EXCEPTION WHEN others THEN INSERT INTO r VALUES ('mesma tentativa, conteúdo diferente: rejeita', SQLERRM LIKE '%conteúdo diferente%'); END; END $$;
-- 8) A -> B -> A (tentativas novas) => a última reaplicação vale
SELECT team_time_import_report(pl('A1','2030-01-10','2030-01-10',jsonb_build_array(d('2030-01-10','regular'))));
SELECT team_time_import_report(pl('B1','2030-01-10','2030-01-10',jsonb_build_array(d('2030-01-10','falta'))));
SELECT team_time_import_report(pl('A2','2030-01-10','2030-01-10',jsonb_build_array(d('2030-01-10','regular')))) ->> 'replay' AS aba \gset
RESET ROLE;
INSERT INTO r SELECT 'A->B->A reaplica A', :'aba'='false' AND (SELECT situacao FROM team_time_daily WHERE dia='2030-01-10')='regular' AND (SELECT count(*) FROM team_time_daily WHERE dia='2030-01-10')=1;
SELECT name, CASE WHEN ok THEN 'OK' ELSE 'FALHOU' END FROM r;
SELECT CASE WHEN bool_and(ok) THEN 'TODOS OK' ELSE 'HÁ FALHAS' END AS resultado FROM r;
