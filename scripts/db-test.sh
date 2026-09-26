#!/usr/bin/env bash
# Runs the database tests (pgTAP) against a throwaway local Postgres server.
# Usage: scripts/db-test.sh
# Requires Postgres 15+ server binaries and the pgtap extension (postgresql-XX-pgtap).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${PGPORT_TEST:-54329}"
DATA="$(mktemp -d)"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$DATA"
  RUN_AS=(runuser -u postgres --)
fi

cleanup() {
  "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA"
}
trap cleanup EXIT

"${RUN_AS[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
"${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses='' -c wal_level=logical" -w start >/dev/null

PSQL=(psql -h /tmp -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -c "create database nexa_test" postgres
"${PSQL[@]}" -d nexa_test -f "$ROOT/supabase/tests/local/supabase_shim.sql" >/dev/null

for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -d nexa_test -f "$f" >/dev/null
done

status=0
for f in "$ROOT"/supabase/tests/database/*.test.sql; do
  echo "# $(basename "$f")"
  out="$("${PSQL[@]}" -d nexa_test -t -A -f "$f" 2>&1)" || status=1
  echo "$out" | grep -E '^(ok|not ok|#|1\.\.)' || true
  if echo "$out" | grep -qE '^not ok|Looks like|ERROR'; then
    echo "$out" | grep -E 'ERROR|Looks like|#   ' || true
    status=1
  fi
done

if [ "$status" = "0" ]; then echo "All database tests passed."; else echo "Database tests failed."; fi
exit "$status"
