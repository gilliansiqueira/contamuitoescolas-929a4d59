#!/usr/bin/env bash
# Roda num PostgreSQL DESCARTÁVEL em /tmp. Zera variáveis PG* para nunca tocar o banco do projeto.
set -euo pipefail
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSSLMODE PGSERVICE DATABASE_URL || true
D=$(cd "$(dirname "$0")" && pwd); T=/tmp/pgtest; rm -rf $T; mkdir -p $T
U=""; [ "$(id -u)" = 0 ] && U="setpriv --reuid=lovable --regid=lovable --clear-groups"
[ -n "$U" ] && chown lovable $T
$U initdb -D $T/data -U tester -A trust >/dev/null
$U pg_ctl -D $T/data -o "-k $T -p 55432 -c listen_addresses=''" -l $T/log -w start >/dev/null
trap '$U pg_ctl -D $T/data -m fast stop >/dev/null; rm -rf $T' EXIT
P="psql -X -q -h $T -p 55432 -U tester -v ON_ERROR_STOP=1"
$P -d postgres -c "CREATE DATABASE ponto_descartavel"
P="$P -d ponto_descartavel"
# Trava: confirma que é o banco local descartável (socket em /tmp, sem rede).
[ "$($P -Atc "select current_database()||'|'||coalesce(inet_server_addr()::text,'socket')")" = "ponto_descartavel|socket" ] || { echo "ABORTADO: não é o banco descartável"; exit 1; }
$P -f $D/schema-stub.sql >/dev/null
$P -f $D/rpc.sql >/dev/null
$P -f $D/integration.sql
# Concorrência: duas sessões com o mesmo conteúdo ao mesmo tempo => 1 gravação + 1 replay.
Q="SET ROLE service_role; SELECT team_time_import_report(jsonb_build_object('idempotency_key',repeat('e',64),'periodoInicio','2030-02-01','periodoFim','2030-02-01','employees','[{\"external_id\":\"pf-2\",\"nome\":\"Pessoa Dois\"}]'::jsonb,'daily','[{\"employee_external_id\":\"pf-2\",\"dia\":\"2030-02-01\",\"marcacoes\":[\"08:00\"],\"situacao\":\"incompleta\"}]'::jsonb,'occurrences','[]'::jsonb))->>'replay', pg_sleep(1);"
$P -Atc "$Q" > $T/c1 & $P -Atc "$Q" > $T/c2 & wait
R=$(cat $T/c1 $T/c2 | cut -d'|' -f1 | sort | tr '\n' ',')
N=$($P -Atc "select count(*) from team_time_daily where employee_external_id='pf-2'")
[ "$R" = "false,true," ] && [ "$N" = "1" ] && echo "concorrência: OK" || { echo "concorrência: FALHOU ($R $N)"; exit 1; }
