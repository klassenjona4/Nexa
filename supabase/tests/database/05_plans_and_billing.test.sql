-- Proves the plan rules: the free project, paid project credits, unlocks, subscriptions, a lapsed
-- subscription, and that billing data can be read only by its owner and written only by the server.
begin;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('b1000000-0000-4000-8000-000000000001', 'free@example.ie', '{"full_name":"Fiona Free"}'),
  ('b1000000-0000-4000-8000-000000000002', 'member@example.ie', '{"full_name":"Mark Member"}'),
  ('b1000000-0000-4000-8000-000000000003', 'subscriber@example.ie', '{"full_name":"Sam Subscriber"}'),
  ('b1000000-0000-4000-8000-000000000004', 'outsider@example.ie', '{"full_name":"Olive Outsider"}');

create temp table fx (k text primary key, v uuid);
grant all on fx to public;
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
create function pg_temp.fx(p text) returns uuid language sql stable as $$ select v from fx where k = p $$;

-- Free plan --------------------------------------------------------------------------
select pg_temp.login('b1000000-0000-4000-8000-000000000001');
select is((select free_project_available from public.my_entitlements()), true, 'a new user has a free project available');
insert into fx select 'g1', group_id from public.create_group_with_project('Free group', 'CS1', 'Free project', null);
insert into fx select 'p1', id from public.projects where group_id = pg_temp.fx('g1');
select is((select plan from public.projects where id = pg_temp.fx('p1')), 'free', 'the first project is on the free plan');
select is((select funded_by from public.projects where id = pg_temp.fx('p1')), 'b1000000-0000-4000-8000-000000000001'::uuid, 'the creator pays for the project');
select is((select free_project_available from public.my_entitlements()), false, 'the free project is used');
select throws_ok($$select * from public.create_group_with_project('Second', 'CS1', 'Second project', null)$$, 'P0001', 'plan_project_limit', 'a second project needs a credit or a subscription');
select throws_ok(format('select public.create_project(%L, %L, %L, null)', pg_temp.fx('g1'), 'CS1', 'Another'), 'P0001', 'plan_project_limit', 'the limit also applies to a new project in an existing group');
select results_eq(
  format('select kind::text, used, max, unlimited from public.project_allowance(%L) order by kind', pg_temp.fx('p1')),
  $$values ('brief_breakdown', 0, 1, false), ('statement_generation', 0, 1, false)$$,
  'a free project allows 1 brief breakdown and 1 statement');
select pg_temp.logout();

set local role service_role;
select is(public.reserve_usage(pg_temp.fx('p1'), 'brief_breakdown'), 1, 'the free brief breakdown is allowed');
select is(public.reserve_usage(pg_temp.fx('p1'), 'brief_breakdown'), null, 'a second free brief breakdown is refused');
select pg_temp.logout();

-- Members who join spend nothing of their own --------------------------------------------
insert into public.group_members (group_id, user_id) values (pg_temp.fx('g1'), 'b1000000-0000-4000-8000-000000000002');
select pg_temp.login('b1000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.project_allowance(pg_temp.fx('p1'))), 2, 'a member sees the project allowance');
select is((select free_project_available from public.my_entitlements()), true, 'joining a project does not use the member''s free project');
insert into fx select 'g2', group_id from public.create_group_with_project('Member group', 'CS2', 'Member project', null);
select is((select plan from public.projects where group_id = pg_temp.fx('g2')), 'free', 'the member still gets their own free project');
select pg_temp.logout();

-- Unlocking an existing project ------------------------------------------------------------
set local role service_role;
select lives_ok(format('select public.apply_project_unlock(%L, %L)', pg_temp.fx('p1'), 'b1000000-0000-4000-8000-000000000002'), 'any member can unlock the project');
select is(public.reserve_usage(pg_temp.fx('p1'), 'brief_breakdown'), n, 'after an unlock, brief breakdown ' || n || ' is allowed')
  from generate_series(2, 4) n;
select is(public.reserve_usage(pg_temp.fx('p1'), 'brief_breakdown'), null, 'an unlock adds exactly 3');
select throws_ok(format('select public.apply_project_unlock(%L, %L)', pg_temp.fx('p1'), 'b1000000-0000-4000-8000-000000000004'), 'P0002', 'not_found', 'an outsider cannot unlock a project');
select pg_temp.logout();

-- Project credits --------------------------------------------------------------------------
update public.billing_accounts set project_credits = 1 where user_id = 'b1000000-0000-4000-8000-000000000001';
select pg_temp.login('b1000000-0000-4000-8000-000000000001');
select is((select project_credits from public.my_entitlements()), 1, 'a bought credit is visible');
insert into fx select 'g3', group_id from public.create_group_with_project('Paid group', 'CS3', 'Paid project', null);
insert into fx select 'p3', id from public.projects where group_id = pg_temp.fx('g3');
select is((select plan from public.projects where id = pg_temp.fx('p3')), 'project', 'a credit makes a paid project');
select is((select project_credits from public.my_entitlements()), 0, 'the credit is used');
select results_eq(
  format('select kind::text, max from public.project_allowance(%L) order by kind', pg_temp.fx('p3')),
  $$values ('brief_breakdown', 3), ('statement_generation', 3)$$,
  'a paid project allows 3 brief breakdowns and 3 statements');
select pg_temp.logout();

-- Subscriptions --------------------------------------------------------------------------
insert into public.billing_accounts (user_id, subscription_id, subscription_status, current_period_end)
  values ('b1000000-0000-4000-8000-000000000003', 'sub_test', 'active', now() + interval '30 days');
select pg_temp.login('b1000000-0000-4000-8000-000000000003');
insert into fx select 'gs' || n, c.group_id from generate_series(1, 3) n cross join lateral public.create_group_with_project('Sub group ' || n, 'CS4', 'Sub project ' || n, null) c;
select is((select count(*)::int from public.projects where funded_by = 'b1000000-0000-4000-8000-000000000003' and plan = 'subscription'), 3, 'a subscriber can create several projects');
insert into fx select 'ps', id from public.projects where title = 'Sub project 1';
select is((select bool_and(unlimited) from public.project_allowance(pg_temp.fx('ps'))), true, 'subscription projects are shown as unlimited');
select pg_temp.logout();

set local role service_role;
select is(public.reserve_usage(pg_temp.fx('ps'), 'statement_generation'), n, 'subscription statement ' || n || ' is allowed')
  from generate_series(1, 30) n;
select is(public.reserve_usage(pg_temp.fx('ps'), 'statement_generation'), null, 'the fair use cap of 30 holds');
select pg_temp.logout();

update public.billing_accounts set subscription_status = 'canceled' where user_id = 'b1000000-0000-4000-8000-000000000003';
set local role service_role;
select throws_ok(format('select public.reserve_usage(%L, %L)', pg_temp.fx('ps'), 'brief_breakdown'), 'P0001', 'subscription_inactive', 'AI stops on a project whose subscription ended');
select pg_temp.logout();
select pg_temp.login('b1000000-0000-4000-8000-000000000003');
select lives_ok($$select * from public.create_group_with_project('After', 'CS4', 'After cancel', null)$$, 'a former subscriber still has their unused free project');
select is((select plan from public.projects where title = 'After cancel'), 'free', 'it is on the free plan');
select throws_ok($$select * from public.create_group_with_project('After 2', 'CS4', 'After cancel 2', null)$$, 'P0001', 'plan_project_limit', 'an ended subscription creates no more projects beyond that');
select is((select count(*)::int from public.tasks t join public.projects p on p.id = t.project_id where p.id = pg_temp.fx('ps')), 0, 'the project data stays readable');
select pg_temp.logout();

set local role service_role;
select lives_ok(format('select public.apply_project_unlock(%L, %L)', pg_temp.fx('ps'), 'b1000000-0000-4000-8000-000000000003'), 'an unlock rescues a project from an ended subscription');
select is((select plan from public.projects where id = pg_temp.fx('ps')), 'project', 'it becomes a paid project');
select is(public.reserve_usage(pg_temp.fx('ps'), 'statement_generation'), 1, 'with a fresh allowance');
select pg_temp.logout();

-- Billing data is private and server written -------------------------------------------------
select pg_temp.login('b1000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.billing_accounts), 1, 'a user reads only their own billing row');
select throws_ok($$update public.billing_accounts set project_credits = 99$$, '42501', null, 'clients cannot give themselves credits');
select throws_ok($$insert into public.billing_accounts (user_id) values ('b1000000-0000-4000-8000-000000000004')$$, '42501', null, 'clients cannot create billing rows');
select throws_ok($$update public.billing_accounts set subscription_status = 'active'$$, '42501', null, 'clients cannot activate a subscription');
select throws_ok($$select * from public.stripe_events$$, '42501', null, 'payment events are not readable');
select throws_ok(format('update public.projects set plan = %L where id = %L', 'subscription', pg_temp.fx('p1')), '42501', null, 'clients cannot change a project''s plan');
select throws_ok(format('update public.projects set unlocks = 9 where id = %L', pg_temp.fx('p1')), '42501', null, 'clients cannot add unlocks');
select throws_ok(format('select public.apply_project_unlock(%L, %L)', pg_temp.fx('p1'), 'b1000000-0000-4000-8000-000000000001'), '42501', null, 'clients cannot unlock projects without paying');
select pg_temp.logout();
select pg_temp.login('b1000000-0000-4000-8000-000000000004');
select throws_ok(format('select * from public.project_allowance(%L)', pg_temp.fx('p1')), 'P0002', 'not_found', 'outsiders cannot see a project''s allowance');
select pg_temp.logout();

select * from finish();
rollback;
