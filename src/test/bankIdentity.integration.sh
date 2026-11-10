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
if [ -n "${BANK_BATCH_MIGRATION:-}" ]; then P+=(-v "batch_migration=$BANK_BATCH_MIGRATION"); fi
[ "$("${P[@]}" -Atc "select current_database()||'|'||coalesce(inet_server_addr()::text,'socket')")" = 'bank_identity_disposable|socket' ] || exit 1
echo 'SQL destination verified: disposable local Unix socket; no TCP listener'
"${P[@]}" -f "$ROOT/src/test/bankIdentity.sql" > "$T/results" 2>&1 || { tail -20 "$T/results"; exit 1; }
grep 'assertions passed' "$T/results"
if [ "${BANK_BATCH_TEST:-1}" = 1 ]; then
  "${P[@]}" -f "$ROOT/src/test/bankBatch.sql" > "$T/batch" 2>&1 || { tail -20 "$T/batch"; exit 1; }
  grep 'assertions passed' "$T/batch"
fi
echo 'Duplicate registrations only warn now (owner rule 2026-11-10): saving a second account is allowed'
"${P[@]}" -c "INSERT INTO bank_accounts(school_id,nome,banco,agencia,conta) VALUES('10000000-0000-0000-0000-000000000003','Fictícia repetida','Sicredi','0001','0009876-5'),('10000000-0000-0000-0000-000000000001','Outra fictícia','Banco Sicredi','00.01','00098765');" >/dev/null
[ "$("${P[@]}" -Atc "select count(*) from bank_accounts where banco in ('Sicredi','Banco Sicredi')")" = 2 ]
"${P[@]}" -c "DELETE FROM bank_accounts WHERE banco in ('Sicredi','Banco Sicredi')" >/dev/null
echo 'Duplicate registration check passed'
if [ "${BANK_BATCH_TEST:-1}" = 1 ]; then
  echo 'Concurrency: overlapping imports of the same account'
  ROWS='[{"data":"2026-11-10","descricao":"Concorrente fictício","valor":1,"tipo":"entrada","dedup_hash":"overlap-shared"}]'
  "${P[@]}" -c "SELECT set_config('test.role','service_role',false); BEGIN; SELECT test_batch(repeat('5',64),'$ROWS'); SELECT pg_sleep(1); COMMIT;" > "$T/import1" 2>&1 & PID=$!
  for i in $(seq 1 100); do
    if [ "$("${P[@]}" -Atc "select count(*) from pg_locks where locktype='advisory' and granted and mode='ShareLock'")" != 0 ]; then break; fi
  done
  # An unrelated identity must not wait for the import's transaction.
  "${P[@]}" -c "SET lock_timeout='300ms'; INSERT INTO bank_accounts(school_id,nome,banco,agencia,conta) VALUES('10000000-0000-0000-0000-000000000001','Independente fictícia','Sicoob','0022','0008888-8');" > "$T/independent" 2>&1
  # Account changes must wait, so the validated destination cannot change mid-batch.
  if "${P[@]}" -c "SET lock_timeout='100ms'; UPDATE bank_accounts SET conta='changed' WHERE id='20000000-0000-0000-0000-000000000001';" > "$T/change" 2>&1; then echo 'FAILED account changed during commit'; exit 1; fi
  grep -q 'lock timeout' "$T/change"
  "${P[@]}" -c "SELECT set_config('test.role','service_role',false); SELECT test_batch(repeat('6',64),'$ROWS');" > "$T/import2" 2>&1
  wait "$PID"
  [ "$("${P[@]}" -Atc "select count(*) from bank_transactions where dedup_hash='overlap-shared'")" = 1 ]
  [ "$("${P[@]}" -Atc "select sum(inseridas)||'|'||sum(duplicadas) from bank_statement_imports where file_hash in(repeat('5',64),repeat('6',64))")" = '1|1' ]
  echo '3 concurrency checks passed: overlap counts, unrelated identity proceeds, account change blocked'
fi