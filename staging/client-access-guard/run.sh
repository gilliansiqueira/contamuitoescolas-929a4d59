#!/usr/bin/env bash
# PostgreSQL DESCARTÁVEL local (socket em pasta própria, sem rede). Nunca usa o banco do projeto.
set -euo pipefail
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSSLMODE PGSERVICE DATABASE_URL LOVABLE_DB_MIGRATION_URL || true
D=$(cd "$(dirname "$0")" && pwd); R=$(cd "$D/../.." && pwd)
T=$(mktemp -d /tmp/acc-pg.XXXXXX)
U=""; [ "$(id -u)" = 0 ] && U="setpriv --reuid=lovable --regid=lovable --clear-groups"
cleanup() { [ -f "$T/data/postmaster.pid" ] && $U pg_ctl -D "$T/data" -m fast stop >/dev/null 2>&1 || true; rm -rf -- "$T"; }
trap cleanup EXIT
[ -n "$U" ] && chown lovable "$T"
PORT=$(( 40000 + RANDOM % 20000 ))
$U initdb -D "$T/data" -U tester -A trust >/dev/null
$U pg_ctl -D "$T/data" -o "-k $T -p $PORT -c listen_addresses=''" -l "$T/log" -w start >/dev/null
P="psql -X -q -h $T -p $PORT -U tester -v ON_ERROR_STOP=1"
$P -d postgres -c "CREATE DATABASE acessos_descartavel"; P="$P -d acessos_descartavel"
G=$($P -Atc "select current_database()||'|'||coalesce(inet_server_addr()::text,'socket')||'|'||current_setting('data_directory')")
case "$G" in "acessos_descartavel|socket|$T/data") echo "ISOLAMENTO OK: banco local $T/data, só socket, sem rede";; *) echo "ABORTADO: destino inesperado"; exit 1;; esac
$P -f "$D/schema-stub.sql" >/dev/null
# Migrations REAIS do módulo, lidas sem alteração
for m in 0096_client_access_vault 0097_client_access_use_admin_manages 0098_client_access_hide_secret_col; do $P -f "$R/drizzle/migrations/$m.sql" >/dev/null; done
$P -f "$D/harness.sql" >/dev/null
$P -f "$D/tests.sql" >/dev/null
$P -f "$D/proposal.sql" >/dev/null
$P -f "$D/tests2.sql" >/dev/null
$P -c "select fase, case when ok then 'PASSOU' else 'FALHOU' end r, nome , obtido from t.res order by n" -A -F' | '
F=$($P -Atc "select count(*) filter (where not ok)||'|'||count(*) from t.res")
echo "falhas|total: $F"; [ "${F%%|*}" = 0 ]
