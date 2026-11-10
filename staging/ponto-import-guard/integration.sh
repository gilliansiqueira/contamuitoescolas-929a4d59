#!/usr/bin/env bash
# Roda num PostgreSQL DESCARTÁVEL em /tmp. Zera variáveis PG* para nunca tocar o banco do projeto.
set -euo pipefail
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSSLMODE PGSERVICE DATABASE_URL || true
D=$(cd "$(dirname "$0")" && pwd)
T=$(mktemp -d /tmp/ponto-pg.XXXXXX)   # pasta exclusiva desta execução
U=""; [ "$(id -u)" = 0 ] && U="setpriv --reuid=lovable --regid=lovable --clear-groups"
cleanup() { [ -f "$T/data/postmaster.pid" ] && $U pg_ctl -D "$T/data" -m fast stop >/dev/null 2>&1 || true; rm -rf -- "$T"; }
trap cleanup EXIT   # instalado ANTES de initdb/start: limpa mesmo se falharem
[ -n "$U" ] && chown lovable "$T"
PORT=$(( 40000 + RANDOM % 20000 ))
$U initdb -D "$T/data" -U tester -A trust >/dev/null
$U pg_ctl -D "$T/data" -o "-k $T -p $PORT -c listen_addresses=''" -l "$T/log" -w start >/dev/null
echo "banco descartável: $T (porta $PORT, só socket local)"
P="psql -X -q -h $T -p $PORT -U tester -v ON_ERROR_STOP=1"
$P -d postgres -c "CREATE DATABASE ponto_descartavel"
P="$P -d ponto_descartavel"
# Trava: confirma que é o banco local descartável (socket em /tmp, sem rede).
[ "$($P -Atc "select current_database()||'|'||coalesce(inet_server_addr()::text,'socket')")" = "ponto_descartavel|socket" ] || { echo "ABORTADO: não é o banco descartável"; exit 1; }
$P -f $D/schema-stub.sql >/dev/null
$P -f $D/rpc.sql >/dev/null
$P -f $D/integration.sql
# Concorrência 1: mesma tentativa em duas sessões => 1 gravação + 1 replay.
mk(){ echo "SET ROLE service_role; SELECT team_time_import_report(jsonb_build_object('attempt_id',md5('$1')::uuid,'content_hash',repeat('$2',64),'periodoInicio','$3','periodoFim','$4','employees','[{\"external_id\":\"pf-2\",\"nome\":\"Pessoa Dois\"}]'::jsonb,'daily',(SELECT jsonb_agg(jsonb_build_object('employee_external_id','pf-2','dia',g::date,'marcacoes','[\"08:00\"]'::jsonb,'situacao','$5')) FROM generate_series('$3'::date,'$4'::date,'1 day') g),'occurrences','[]'::jsonb))->>'replay', pg_sleep(1);"; }
$P -Atc "$(mk c1 e 2030-02-01 2030-02-01 incompleta)" > "$T"/c1 & $P -Atc "$(mk c1 e 2030-02-01 2030-02-01 incompleta)" > "$T"/c2 & wait
R=$(cat "$T"/c1 "$T"/c2 | cut -d'|' -f1 | sort | tr '\n' ',')
N=$($P -Atc "select count(*) from team_time_daily where employee_external_id='pf-2'")
[ "$R" = "false,true," ] && [ "$N" = "1" ] && echo "concorrência mesma tentativa: OK" || { echo "concorrência mesma tentativa: FALHOU ($R $N)"; exit 1; }
# Concorrência 2: intervalos DIFERENTES sobrepostos (03/01–03/03 e 03/02–03/04) ao mesmo tempo.
$P -Atc "$(mk o1 1 2030-03-01 2030-03-03 regular)" > "$T"/o1 & $P -Atc "$(mk o2 2 2030-03-02 2030-03-04 falta)" > "$T"/o2 & wait
N=$($P -Atc "select count(*)||'|'||count(distinct dia) from team_time_daily where employee_external_id='pf-2' and dia between '2030-03-01' and '2030-03-04'")
S=$($P -Atc "select count(*) from team_time_sync_runs where status='success' and reference_date in ('2030-03-03','2030-03-04')")
[ "$N" = "4|4" ] && [ "$S" = "2" ] && echo "concorrência intervalos sobrepostos: OK (4 dias, sem duplicar, 2 execuções)" || { echo "sobrepostos: FALHOU ($N $S)"; exit 1; }
