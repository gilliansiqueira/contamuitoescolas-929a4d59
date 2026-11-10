#!/usr/bin/env bash
set -euo pipefail
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSSLMODE PGSERVICE DATABASE_URL
ROOT=$(pwd)
T=$(mktemp -d /tmp/bank-identity.XXXXXX)
U=(); if [ "$(id -u)" = 0 ]; then U=(setpriv --reuid=lovable --regid=lovable --clear-groups); chown lovable "$T"; fi
cleanup() { if [ -f "$T/data/postmaster.pid" ]; then "${U[@]}" pg_ctl -D "$T/data" -m fast stop >/dev/null; fi; rm -rf -- "$T"; }
trap cleanup EXIT
"${U[@]}" initdb -D "$T/data" -U tester -A trust >/dev/null
"${U[@]}" pg_ctl -D "$T/data" -o "-k $T -p 55439 -c listen_addresses=''" -l "$T/log" -w start >/dev/null
P=(psql -X -h "$T" -p 55439 -U tester -v ON_ERROR_STOP=1)
"${P[@]}" -d postgres -c 'CREATE DATABASE bank_identity_disposable' >/dev/null
P+=(-d bank_identity_disposable)
[ "$("${P[@]}" -Atc "select current_database()||'|'||coalesce(inet_server_addr()::text,'socket')")" = 'bank_identity_disposable|socket' ] || exit 1
echo 'SQL destination verified: disposable local Unix socket; no TCP listener'
"${P[@]}" -f "$ROOT/src/test/bankIdentity.sql" > "$T/results" 2>&1 || { tail -20 "$T/results"; exit 1; }
grep 'assertions passed' "$T/results"