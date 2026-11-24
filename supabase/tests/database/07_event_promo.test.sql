-- Proves the event promo rules: a valid code gives Premium for its number of days, codes outside
-- their window, at their cap or deactivated are refused with the same error, each user redeems
-- once per campaign, Premium unlocks the monthly plan's rules and ends on its own, and clients can
-- neither read nor write promo data nor give themselves Premium.
-- Concurrent redemptions near the cap are proved by scripts/db-test-concurrency.sh.
begin;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('c1000000-0000-4000-8000-000000000001', 'ada@example.ie', '{"full_name":"Ada Attendee"}'),
  ('c1000000-0000-4000-8000-000000000002', 'ben@example.ie', '{"full_name":"Ben Attendee"}'),
  ('c1000000-0000-4000-8000-000000000003', 'cara@example.ie', '{"full_name":"Cara Attendee"}'),
  ('c1000000-0000-4000-8000-000000000004', 'dan@example.ie', '{"full_name":"Dan Subscriber"}');

create function pg_temp.login(p uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
end;
$$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end;
$$;

insert into public.promo_codes (code, campaign, max_uses, valid_from, valid_until, premium_days) values
  ('BCDFGHJK23', 'event-test', 2, now() - interval '1 hour', now() + interval '5 hours', 30),
  ('MNPQRSTV45', 'early-test', 60, now() + interval '1 hour', now() + interval '5 hours', 30),
  ('WXYZ6789BC', 'late-test', 60, now() - interval '5 hours', now() - interval '1 second', 30),
  ('DFGHJKMN67', 'off-test', 60, now() - interval '1 hour', now() + interval '5 hours', 30),
  ('PQRSTVWX89', 'second-test', 60, now() - interval '1 hour', now() + interval '5 hours', 7);
update public.promo_codes set active = false where code = 'DFGHJKMN67';

-- Code format ----------------------------------------------------------------------------------
select throws_ok($$insert into public.promo_codes (code, campaign, valid_from, valid_until) values ('BCDFGHJKO2', 'x-test', now(), now() + interval '1 hour')$$,
  '23514', null, 'codes cannot contain ambiguous characters such as O');
select throws_ok($$insert into public.promo_codes (code, campaign, valid_from, valid_until) values ('BCDFGHJKA2', 'x-test', now(), now() + interval '1 hour')$$,
  '23514', null, 'codes cannot contain vowels, so they never spell a word');
select throws_ok($$insert into public.promo_codes (code, campaign, valid_from, valid_until) values ('BCDFGHJK2', 'x-test', now(), now() + interval '1 hour')$$,
  '23514', null, 'codes have exactly 10 characters');
select throws_ok($$insert into public.promo_codes (code, campaign, valid_from, valid_until) values ('BCDFGHJK22', 'x-test', now(), now() - interval '1 hour')$$,
  '23514', null, 'a window must end after it starts');
select is((select max_uses from public.promo_codes where code = 'MNPQRSTV45'), 60, 'the default cap is 60 uses');

-- Valid code -----------------------------------------------------------------------------------
set local role service_role;
select is((select premium_until from public.redeem_promo_code('c1000000-0000-4000-8000-000000000001', '  bcdfghjk23 ')),
  now() + interval '30 days', 'a valid code gives Premium for 30 days; input is trimmed and uppercased');
select pg_temp.logout();
select is((select uses from public.promo_codes where code = 'BCDFGHJK23'), 1, 'the use is counted');
select is((select count(*)::int from public.promo_redemptions where user_id = 'c1000000-0000-4000-8000-000000000001'), 1, 'the redemption is recorded');
select is((select campaign from public.promo_redemptions where user_id = 'c1000000-0000-4000-8000-000000000001'), 'event-test', 'with its campaign');

-- Same user twice ------------------------------------------------------------------------------
set local role service_role;
select throws_ok($$select * from public.redeem_promo_code('c1000000-0000-4000-8000-000000000001', 'BCDFGHJK23')$$,
  'P0001', 'promo_already_redeemed', 'a user cannot redeem the same campaign twice');
select pg_temp.logout();
select is((select uses from public.promo_codes where code = 'BCDFGHJK23'), 1, 'the refused attempt does not use up the code');
select is((select premium_until from public.billing_accounts where user_id = 'c1000000-0000-4000-8000-000000000001'),
  now() + interval '30 days', 'nor extend Premium');

-- Window, deactivation, unknown codes ----------------------------------------------------------
set local role service_role;
select throws_ok($$select * from public.redeem_promo_code('c1000000-0000-4000-8000-000000000002', 'MNPQRSTV45')$$,
  'P0001', 'promo_invalid', 'a code before its window is refused');
select throws_ok($$select * from public.redeem_promo_code('c1000000-0000-4000-8000-000000000002', 'WXYZ6789BC')$$,
  'P0001', 'promo_invalid', 'a code after its window is refused');
select throws_ok($$select * from public.redeem_promo_code('c1000000-0000-4000-8000-000000000002', 'DFGHJKMN67')$$,
  'P0001', 'promo_invalid', 'a deactivated code is refused');
select throws_ok($$select * from public.redeem_promo_code('c1000000-0000-4000-8000-000000000002', 'ZZZZZZZZZZ')$$,
  'P0001', 'promo_invalid', 'an unknown code gets the same error');
select throws_ok($$select * from public.redeem_promo_code('c1000000-0000-4000-8000-000000000002', null)$$,
  'P0001', 'promo_invalid', 'an empty code gets the same error');
select pg_temp.logout();
select is((select sum(uses)::int from public.promo_codes where code in ('MNPQRSTV45', 'WXYZ6789BC', 'DFGHJKMN67')), 0, 'refused codes are not counted');

-- Cap ------------------------------------------------------------------------------------------
set local role service_role;
select lives_ok($$select * from public.redeem_promo_code('c1000000-0000-4000-8000-000000000002', 'BCDFGHJK23')$$, 'the last use below the cap works');
select throws_ok($$select * from public.redeem_promo_code('c1000000-0000-4000-8000-000000000003', 'BCDFGHJK23')$$,
  'P0001', 'promo_invalid', 'a code at its cap is refused with the same error');
select pg_temp.logout();
select is((select uses from public.promo_codes where code = 'BCDFGHJK23'), 2, 'the cap is never exceeded');
select throws_ok($$update public.promo_codes set uses = 3 where code = 'BCDFGHJK23'$$, '23514', null, 'the table itself refuses more uses than the cap');

-- Premium stacks from the later of now and the current end ---------------------------------------
set local role service_role;
select is((select premium_until from public.redeem_promo_code('c1000000-0000-4000-8000-000000000001', 'PQRSTVWX89')),
  now() + interval '37 days', 'a second campaign extends Premium from its current end');
select pg_temp.logout();
update public.billing_accounts set premium_until = now() - interval '3 days' where user_id = 'c1000000-0000-4000-8000-000000000002';
set local role service_role;
select is((select premium_until from public.redeem_promo_code('c1000000-0000-4000-8000-000000000002', 'PQRSTVWX89')),
  now() + interval '7 days', 'an ended Premium restarts from now, not from the old end');
select pg_temp.logout();

-- Premium uses the existing plan rules -----------------------------------------------------------
select pg_temp.login('c1000000-0000-4000-8000-000000000001');
select is((select subscription_active from public.my_entitlements()), true, 'Premium counts as the monthly plan');
select lives_ok($$select * from public.create_group_with_project('Promo 1', 'EV1', 'Promo project 1', null)$$, 'a Premium user creates a project');
select lives_ok($$select * from public.create_group_with_project('Promo 2', 'EV1', 'Promo project 2', null)$$, 'and another, beyond the free plan');
select is((select count(*)::int from public.projects where funded_by = 'c1000000-0000-4000-8000-000000000001' and plan = 'subscription'), 2, 'both are on the monthly plan');
select is((select free_project_available from public.my_entitlements()), true, 'Premium does not use up the free project');
select pg_temp.logout();

-- Premium ends on its own --------------------------------------------------------------------------
update public.billing_accounts set premium_until = now() - interval '1 second' where user_id = 'c1000000-0000-4000-8000-000000000001';
select pg_temp.login('c1000000-0000-4000-8000-000000000001');
select is((select subscription_active from public.my_entitlements()), false, 'Premium ends when premium_until passes, with no job');
select pg_temp.logout();
set local role service_role;
select throws_ok(format('select public.reserve_usage(%L, %L)', (select id from public.projects where title = 'Promo project 1'), 'brief_breakdown'),
  'P0001', 'subscription_inactive', 'AI stops on Premium projects after Premium ends, as after a cancelled subscription');
select pg_temp.logout();

-- A Stripe subscription still counts on its own -------------------------------------------------
insert into public.billing_accounts (user_id, subscription_id, subscription_status, current_period_end)
  values ('c1000000-0000-4000-8000-000000000004', 'sub_promo_test', 'active', now() + interval '10 days');
select pg_temp.login('c1000000-0000-4000-8000-000000000004');
select is((select subscription_active from public.my_entitlements()), true, 'a paid subscription is unaffected');
select pg_temp.logout();

-- Clients cannot touch promo data or give themselves Premium ---------------------------------------
select pg_temp.login('c1000000-0000-4000-8000-000000000003');
select throws_ok($$select * from public.promo_codes$$, '42501', null, 'clients cannot read promo codes');
select throws_ok($$insert into public.promo_codes (code, campaign, valid_from, valid_until) values ('BCDFGHJK99', 'mine', now(), now() + interval '1 day')$$, '42501', null, 'clients cannot create promo codes');
select throws_ok($$update public.promo_codes set active = true$$, '42501', null, 'clients cannot change promo codes');
select throws_ok($$select * from public.promo_redemptions$$, '42501', null, 'clients cannot read redemptions');
select throws_ok($$insert into public.promo_redemptions (user_id, code_id, campaign, premium_until) select 'c1000000-0000-4000-8000-000000000003', gen_random_uuid(), 'x', now()$$, '42501', null, 'clients cannot write redemptions');
select throws_ok($$select * from public.redeem_promo_code('c1000000-0000-4000-8000-000000000003', 'PQRSTVWX89')$$, '42501', null, 'clients cannot call the redemption function');
select throws_ok($$select * from public.promo_campaign_status('event-test')$$, '42501', null, 'clients cannot read campaign usage');
select throws_ok($$select public.rate_limit_count('x', 900)$$, '42501', null, 'clients cannot read rate limit counters');
select throws_ok($$update public.billing_accounts set premium_until = now() + interval '1 year'$$, '42501', null, 'clients cannot give themselves Premium');
select throws_ok($$insert into public.marketing_consents (user_id, email_updates, source) values ('c1000000-0000-4000-8000-000000000003', true, 'account')$$, '42501', null, 'clients cannot write consent records directly');
select pg_temp.logout();
select pg_temp.login('c1000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.billing_accounts), 1, 'a user reads only their own billing row');
select ok((select premium_until from public.billing_accounts) > now(), 'and sees their own Premium end date');
select pg_temp.logout();
set local role anon;
select throws_ok($$select * from public.promo_codes$$, '42501', null, 'visitors cannot read promo codes');
select throws_ok($$select * from public.redeem_promo_code('c1000000-0000-4000-8000-000000000003', 'PQRSTVWX89')$$, '42501', null, 'visitors cannot redeem');
select pg_temp.logout();

-- Consent records are private ------------------------------------------------------------------
insert into public.marketing_consents (user_id, email_updates, source) values
  ('c1000000-0000-4000-8000-000000000001', true, 'redeem'),
  ('c1000000-0000-4000-8000-000000000002', false, 'redeem');
select pg_temp.login('c1000000-0000-4000-8000-000000000001');
select results_eq($$select user_id::text, email_updates from public.marketing_consents$$,
  $$values ('c1000000-0000-4000-8000-000000000001', true)$$, 'a user reads only their own consent record');
select ok((public.export_my_data() -> 'promo_redemptions') @> '[{"campaign":"event-test"}]', 'the data export includes redemptions');
select is(public.export_my_data() -> 'email_updates_consent' ->> 'email_updates', 'true', 'and the email consent');
select pg_temp.logout();

-- Usage for the operator ----------------------------------------------------------------------------
set local role service_role;
select results_eq($$select uses, max_uses, redemptions from public.promo_campaign_status('event-test')$$,
  $$values (2, 2, 2::bigint)$$, 'the operator sees uses against the cap');
select pg_temp.logout();

-- Account deletion removes redemptions but keeps the count ---------------------------------------
delete from auth.users where id = 'c1000000-0000-4000-8000-000000000002';
select is((select count(*)::int from public.promo_redemptions where user_id = 'c1000000-0000-4000-8000-000000000002'), 0, 'deleting an account deletes its redemptions');
select is((select uses from public.promo_codes where code = 'BCDFGHJK23'), 2, 'the use count stays, so the cap still holds');

select * from finish();
rollback;
