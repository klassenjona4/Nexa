#!/usr/bin/env bash
# Concurrency test for promo codes: many users redeem the same code at the same moment, from
# separate database connections, and the cap must hold exactly. Called by scripts/db-test.sh
# with the psql command line of the throwaway test database.
# Usage: scripts/db-test-concurrency.sh <psql args...>
set -euo pipefail

PSQL=("$@")
USERS=40
CAP=10

"${PSQL[@]}" <<SQL >/dev/null
insert into auth.users (id, email)
select ('d1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'race' || n || '@example.ie'
from generate_series(1, $USERS) n;
insert into public.promo_codes (code, campaign, max_uses, valid_from, valid_until)
values ('RCVBNMXZ23', 'race-test', $CAP, now() - interval '1 hour', now() + interval '1 hour');
SQL

# Every user, plus a second attempt by each of the first 10, all at once.
pids=()
for n in $(seq 1 $USERS) $(seq 1 10); do
  uid="d1000000-0000-4000-8000-$(printf '%012d' "$n")"
  "${PSQL[@]}" -c "set role service_role; select * from public.redeem_promo_code('$uid', 'RCVBNMXZ23');" >/dev/null 2>&1 &
  pids+=($!)
done
for pid in "${pids[@]}"; do wait "$pid" || true; done

result="$("${PSQL[@]}" -t -A -c "select uses || ' ' || (select count(*) from public.promo_redemptions where campaign = 'race-test') || ' ' || (select count(distinct user_id) from public.promo_redemptions where campaign = 'race-test') from public.promo_codes where code = 'RCVBNMXZ23'")"
premium="$("${PSQL[@]}" -t -A -c "select count(*) from public.billing_accounts where premium_until > now() and user_id::text like 'd1000000-%'")"

"${PSQL[@]}" <<SQL >/dev/null
delete from auth.users where id::text like 'd1000000-%';
delete from public.promo_codes where campaign = 'race-test';
SQL

echo "# concurrency: $((USERS + 10)) simultaneous redemptions against a cap of $CAP"
if [ "$result" = "$CAP $CAP $CAP" ] && [ "$premium" = "$CAP" ]; then
  echo "ok 1 - uses, redemptions and Premium grants all equal the cap ($result, $premium)"
else
  echo "not ok 1 - expected '$CAP $CAP $CAP' and $CAP Premium users, got '$result' and $premium"
  exit 1
fi
