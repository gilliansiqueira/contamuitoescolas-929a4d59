#!/usr/bin/env bash
set -euo pipefail
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSSLMODE PGSERVICE DATABASE_URL
ROOT=$(pwd)
T=$(mktemp -d /tmp/bank-identity.XXXXXX)
U=(); if [ "$(id -u)" = 0 ]; then U=(setpriv --reuid=lovable --regid=lovable --clear-groups); chown lovable "$T"; fi
cleanup() { if [ -f "$T/data/postmaster.pid" ]; then "${U[@]}" pg_ctl -D "$T/data" -m fast stop >/dev/null; fi; rm -rf -- "$T"; }
trap cleanup EXIT
"${U[@]}" initdb -D "$T/data" -U tester -A trust --encoding=UTF8 >/dev/null
"${U[@]}" pg_ctl -D "$T/data" -o "-k $T -p 55439 -c listen_addresses=''" -l "$T/log" -w start >/dev/null
P=(psql -X -h "$T" -p 55439 -U tester -v ON_ERROR_STOP=1)
"${P[@]}" -d postgres -c 'CREATE DATABASE bank_identity_disposable' >/dev/null
P+=(-d bank_identity_disposable)
[ "$("${P[@]}" -Atc "select current_database()||'|'||coalesce(inet_server_addr()::text,'socket')")" = 'bank_identity_disposable|socket' ] || exit 1
echo 'SQL destination verified: disposable local Unix socket; no TCP listener'
"${P[@]}" -f "$ROOT/src/test/bankIdentity.sql" > "$T/results" 2>&1 || { tail -20 "$T/results"; exit 1; }
grep 'assertions passed' "$T/results"
echo 'Concurrency: two independent sessions, same complete identity, different companies'
Q="INSERT INTO bank_accounts(school_id,nome,banco,agencia,conta) VALUES('10000000-0000-0000-0000-000000000001','Fictícia concorrente','Sicredi','0001','0009876-5');"
"${P[@]}" -c "BEGIN; $Q SELECT pg_sleep(1); COMMIT;" > "$T/session1" 2>&1 & PID=$!
for i in $(seq 1 30); do
  if [ "$("${P[@]}" -Atc "select count(*) from pg_locks where locktype='advisory' and granted and classid=1")" != 0 ]; then break; fi
  if ! kill -0 "$PID" 2>/dev/null; then break; fi
done
if "${P[@]}" -c "INSERT INTO bank_accounts(school_id,nome,banco,agencia,conta) VALUES('10000000-0000-0000-0000-000000000002','Outra fictícia','Banco Sicredi','00.01','00098765');" > "$T/session2" 2>&1; then echo 'FAILED: concurrent duplicate accepted'; exit 1; fi
wait "$PID"
grep -q 'duplicado ou ambíguo' "$T/session2"
[ "$("${P[@]}" -Atc "select count(*) from bank_accounts where banco in ('Sicredi','Banco Sicredi')")" = 1 ]
echo 'Concurrency passed: overlapping sessions cannot bind the same registered identity twice'