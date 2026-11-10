#!/usr/bin/env bash
# Homologação isolada: schema COMPLETO das migrations do repositório (sem comandos de dados) + rpc.sql + tests.sql + e2e.
# Uso (da raiz do projeto): bash staging/ponto-import-guard/fullschema/run.sh <copia-em-/tmp>
#   <copia> = cópia do código fora de /dev-server, com node_modules ligado e os patches aplicados (ver README).
set -uo pipefail
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSSLMODE PGSERVICE DATABASE_URL SUPABASE_DB_URL || true
F=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$F/../../.." && pwd); C=${1:?informe a cópia em /tmp}
case "$C" in /tmp/*) ;; *) echo "ABORTADO: a cópia precisa estar em /tmp"; exit 1;; esac
T=$(mktemp -d /tmp/ponto-full.XXXXXX); S=$(mktemp -d /tmp/ponto-sql.XXXXXX)
U=""; [ "$(id -u)" = 0 ] && U="setpriv --reuid=lovable --regid=lovable --clear-groups"; [ -n "$U" ] && chown lovable "$T"
cleanup() { [ -f "$T/data/postmaster.pid" ] && $U pg_ctl -D "$T/data" -m fast stop >/dev/null 2>&1; rm -rf -- "$T" "$S"; }
trap cleanup EXIT
mkdir -p "$S/a" "$S/b"
python3 "$F/strip.py" "$ROOT/supabase/migrations" "$S/a" >/dev/null; python3 "$F/strip.py" "$ROOT/drizzle/migrations" "$S/b" >/dev/null
PORT=$(( 40000 + RANDOM % 20000 ))
$U initdb -D "$T/data" -U tester -A trust >/dev/null || exit 1
$U pg_ctl -D "$T/data" -o "-k $T -p $PORT -c listen_addresses=''" -l "$T/log" -w start >/dev/null || exit 1
P="psql -X -q -h $T -p $PORT -U tester"; $P -d postgres -c "CREATE DATABASE schema_descartavel" >/dev/null; P="$P -d schema_descartavel"
[ "$($P -Atc "select current_database()||'|'||coalesce(inet_server_addr()::text,'socket')")" = "schema_descartavel|socket" ] || { echo ABORTADO; exit 1; }
$P -v ON_ERROR_STOP=1 -f "$F/prelude.sql" >/dev/null 2>&1 || { echo "prelude falhou"; exit 1; }
ok=0; fail=0
for f in "$S"/a/*.sql "$S"/b/*.sql; do if $P -v ON_ERROR_STOP=1 --single-transaction -f "$f" >/dev/null 2>&1; then ok=$((ok+1)); else fail=$((fail+1)); echo "  migration não aplicada: $(basename "$f")"; fi; done
echo "migrations aplicadas: $ok, não aplicadas: $fail"
$P -v ON_ERROR_STOP=1 -f "$F/../rpc.sql" >/dev/null || { echo "rpc.sql falhou"; exit 1; }
$P -At -v ON_ERROR_STOP=1 -f "$F/tests.sql" 2>&1 | grep -E '^(OK|FALHA)|/' ; RC1=${PIPESTATUS[0]}
rm -rf "$C/staging/ponto-import-guard"; mkdir -p "$C/staging"; cp -r "$F/.." "$C/staging/ponto-import-guard"
cat > "$C/vt.e2e.config.ts" <<CFG
import { defineConfig } from "vitest/config"; import path from "path";
export default defineConfig({ test: { environment: "node", include: ["staging/ponto-import-guard/fullschema/*.test.ts"], testTimeout: 20000 }, resolve: { alias: { "@": path.resolve("$C/src") } } });
CFG
env -i PATH="$PATH" HOME=/tmp/ph-home PGTEST_SOCKET_DIR="$T" PGTEST_PORT="$PORT" bash -c "cd '$C' && npx vitest run --config vt.e2e.config.ts 2>&1 | grep -E 'Tests|✓|×|FAIL'"; RC2=$?
exit $(( RC1 || RC2 ))
