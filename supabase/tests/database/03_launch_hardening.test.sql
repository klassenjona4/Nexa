-- Proves the launch hardening rules: peer review integrity, account deletion cascades, email
-- invites bound to their address, quotas, the log rate limit, the daily AI ceiling and the
-- sign up hook.
begin;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'owner@example.ie', '{"full_name":"Aoife Owner"}'),
  ('a0000000-0000-4000-8000-000000000002', 'bob@example.ie', '{"full_name":"Bob Member"}'),
  ('a0000000-0000-4000-8000-000000000003', 'ciara@example.ie', '{"full_name":"Ciara Member"}'),
  ('d0000000-0000-4000-8000-000000000001', 'busy@example.ie', '{"full_name":"Busy Student"}'),
  ('e0000000-0000-4000-8000-000000000001', 'mallory@evil.example', '{"full_name":"Mallory"}'),
  ('f0000000-0000-4000-8000-000000000001', 'Friend@Example.ie', '{"full_name":"Fionn Friend"}');

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
  perform set_config('role', 'none', true);
end;
$$;
create function pg_temp.fx(p text) returns uuid language sql stable as $$ select v from fx where k = p $$;

select pg_temp.login('a0000000-0000-4000-8000-000000000001');
insert into fx select 'g', group_id from public.create_group_with_project('Media Law group 4', 'MDIA7012', 'Assignment 2', null);
insert into fx select 'p', id from public.projects where group_id = pg_temp.fx('g');
select pg_temp.logout();
insert into public.group_members (group_id, user_id) values
  (pg_temp.fx('g'), 'a0000000-0000-4000-8000-000000000002'),
  (pg_temp.fx('g'), 'a0000000-0000-4000-8000-000000000003');

-- Peer review integrity -------------------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000001');
insert into public.tasks (project_id, title, assignee_id) values (pg_temp.fx('p'), 'Alice task', 'a0000000-0000-4000-8000-000000000001');
insert into fx select 't1', id from public.tasks where title = 'Alice task';
update public.tasks set status = 'done' where id = pg_temp.fx('t1');
select is((select completed_by from public.tasks where id = pg_temp.fx('t1')), 'a0000000-0000-4000-8000-000000000001'::uuid, 'the member who marks a task as done is recorded');
select throws_ok(format('update public.tasks set assignee_id = %L where id = %L', 'a0000000-0000-4000-8000-000000000002', pg_temp.fx('t1')), 'P0001', 'task_done_locked', 'a done task keeps its assignee, so it cannot be handed to a teammate to self-confirm');
select throws_ok(format('select public.review_task(%L, %L)', pg_temp.fx('t1'), 'confirmed'), 'P0001', 'own_task', 'the assignee cannot confirm their own task');

insert into public.tasks (project_id, title, assignee_id) values (pg_temp.fx('p'), 'Handed over', 'a0000000-0000-4000-8000-000000000002');
insert into fx select 't2', id from public.tasks where title = 'Handed over';
update public.tasks set status = 'done' where id = pg_temp.fx('t2');
select throws_ok(format('select public.review_task(%L, %L)', pg_temp.fx('t2'), 'confirmed'), 'P0001', 'own_task', 'the member who marked a task as done cannot confirm it');
select pg_temp.logout();

select pg_temp.login('a0000000-0000-4000-8000-000000000002');
select throws_ok(format('select public.review_task(%L, %L)', pg_temp.fx('t2'), 'confirmed'), 'P0001', 'own_task', 'the assignee cannot confirm it either');
select pg_temp.logout();

select pg_temp.login('a0000000-0000-4000-8000-000000000003');
select lives_ok(format('select public.review_task(%L, %L)', pg_temp.fx('t2'), 'confirmed'), 'another teammate can confirm it');
select throws_ok(format('update public.tasks set completed_by = %L where id = %L', 'a0000000-0000-4000-8000-000000000003', pg_temp.fx('t2')), '42501', null, 'clients cannot write completed_by');
select pg_temp.logout();

select pg_temp.login('a0000000-0000-4000-8000-000000000001');
select lives_ok(format('update public.tasks set status = %L where id = %L', 'in_progress', pg_temp.fx('t1')), 'a done task can be reopened');
select lives_ok(format('update public.tasks set assignee_id = %L where id = %L', 'a0000000-0000-4000-8000-000000000002', pg_temp.fx('t1')), 'an open task can be reassigned');
select pg_temp.logout();

-- Account deletion clears references instead of failing ---------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000002');
insert into public.tasks (project_id, title, assignee_id) values (pg_temp.fx('p'), 'Bob task', 'a0000000-0000-4000-8000-000000000002');
update public.tasks set status = 'done' where title = 'Bob task';
select pg_temp.logout();
insert into public.statements (project_id, sections, generated_by) values (pg_temp.fx('p'), '[{"heading":"Summary","body":"Draft"}]', 'a0000000-0000-4000-8000-000000000002');
select pg_temp.login('a0000000-0000-4000-8000-000000000002');
update public.statements set sections = '[{"heading":"Summary","body":"Edited"}]' where project_id = pg_temp.fx('p');
select pg_temp.logout();
select lives_ok($$delete from auth.users where id = 'a0000000-0000-4000-8000-000000000002'$$, 'an account that created, completed and edited work can be deleted');
select is((select count(*)::int from public.tasks where title = 'Bob task' and created_by is null and completed_by is null and assignee_id is null), 1, 'task references to the deleted account are cleared');
select is((select count(*)::int from public.tasks where id = pg_temp.fx('t2') and status = 'done' and assignee_id is null), 1, 'the cascade may clear the assignee of a done task');
select is((select count(*)::int from public.statements where generated_by is null and edited_by is null), 1, 'statement references to the deleted account are cleared');

-- Email invites belong to the invited address -----------------------------------------
insert into public.invites (group_id, project_id, kind, email, nonce, code_hash, max_uses)
  values (pg_temp.fx('g'), pg_temp.fx('p'), 'email', 'friend@example.ie', gen_random_bytes(16), sha256('email-code'), 1);
set local role service_role;
select throws_ok(format('select * from public.accept_invite(%L, %L)', sha256('email-code'), 'e0000000-0000-4000-8000-000000000001'), 'P0001', 'invite_wrong_account', 'an email invite cannot be used by another account');
select is((select use_count from public.invites where code_hash = sha256('email-code')), 0, 'a refused attempt does not use the invite');
select is((select already_member from public.accept_invite(sha256('email-code'), 'f0000000-0000-4000-8000-000000000001')), false, 'the invited address can accept, in any letter case');
select pg_temp.logout();

-- Quotas ---------------------------------------------------------------------------
select pg_temp.login('d0000000-0000-4000-8000-000000000001');
select lives_ok(format('select * from public.create_group_with_project(%L, %L, %L, null)', 'Group ' || n, '', 'Project ' || n), 'group ' || n || ' of 10 today')
  from generate_series(1, 10) n;
select throws_ok($$select * from public.create_group_with_project('Group 11', '', 'Project 11', null)$$, 'P0001', 'group_limit', 'an eleventh group in one day is refused');
insert into fx select 'dg', id from public.groups where name = 'Group 1';
select lives_ok(format('select public.create_project(%L, %L, %L, null)', pg_temp.fx('dg'), '', 'Extra ' || n), 'project ' || n || ' of 10 in a group')
  from generate_series(2, 10) n;
select throws_ok(format('select public.create_project(%L, %L, %L, null)', pg_temp.fx('dg'), '', 'Extra 11'), 'P0001', 'project_limit', 'a group holds at most 10 projects');
insert into fx select 'dp', id from public.projects where title = 'Project 2';
insert into fx select 'dp3', id from public.projects where title = 'Project 3';
select pg_temp.logout();

insert into public.tasks (project_id, title) select pg_temp.fx('dp'), 'Task ' || n from generate_series(1, 300) n;
select throws_ok(format('insert into public.tasks (project_id, title) values (%L, %L)', pg_temp.fx('dp'), 'Task 301'), 'P0001', 'task_limit', 'a project holds at most 300 tasks');
insert into fx select 'dt', id from public.tasks where project_id = pg_temp.fx('dp') and title = 'Task 1';
insert into public.task_links (task_id, url) select pg_temp.fx('dt'), 'https://example.ie/file-' || n from generate_series(1, 50) n;
select throws_ok(format('insert into public.task_links (task_id, url) values (%L, %L)', pg_temp.fx('dt'), 'https://example.ie/file-51'), 'P0001', 'link_limit', 'a task holds at most 50 links');

-- Log entries per member per hour ------------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000003');
insert into public.tasks (project_id, title) values (pg_temp.fx('p'), 'Toggle');
insert into fx select 'tt', id from public.tasks where title = 'Toggle';
do $$
begin
  while (select count(*) from public.activity_log
         where actor_id = 'a0000000-0000-4000-8000-000000000003' and created_at > now() - interval '1 hour') < 600 loop
    update public.tasks
      set status = case when status = 'todo' then 'in_progress'::public.task_status else 'todo'::public.task_status end
      where id = pg_temp.fx('tt');
  end loop;
end;
$$;
select throws_ok(format('update public.tasks set status = %L where id = %L', 'done', pg_temp.fx('tt')), 'P0001', 'rate_limited', 'a member writes at most 600 log entries per hour');
select pg_temp.logout();

-- Daily AI ceiling across projects -------------------------------------------------------
update public.service_limits set max_value = 2 where name = 'ai_requests_per_day';
set local role service_role;
select is(public.reserve_usage(pg_temp.fx('p'), 'brief_breakdown'), 1, 'first AI request of the day');
select is(public.reserve_usage(pg_temp.fx('dp'), 'brief_breakdown'), 1, 'second AI request of the day, in another project');
select throws_ok(format('select public.reserve_usage(%L, %L)', pg_temp.fx('dp3'), 'brief_breakdown'), 'P0001', 'ai_daily_limit', 'the daily ceiling holds across projects');
select is((select count(*)::int from public.project_usage where project_id = pg_temp.fx('dp3') and used > 0), 0, 'a refused request does not count against the project');
select lives_ok(format('select public.release_usage(%L, %L)', pg_temp.fx('dp'), 'brief_breakdown'), 'a failed call releases its reservation');
select is(public.reserve_usage(pg_temp.fx('dp3'), 'brief_breakdown'), 1, 'the released unit can be used by any project');
select pg_temp.logout();

-- Sign up hook ---------------------------------------------------------------------
select ok(public.hook_before_user_created('{"user":{"email":"new@example.ie","app_metadata":{"provider":"email"}}}') ? 'error', 'an email sign up without an allowance is refused');
insert into public.signup_allowances (email, expires_at) values
  ('new@example.ie', now() + interval '2 minutes'),
  ('old@example.ie', now() - interval '1 minute');
select is(public.hook_before_user_created('{"user":{"email":"New@Example.ie","app_metadata":{"provider":"email"}}}'), '{}'::jsonb, 'an email sign up with an allowance is accepted');
select ok(public.hook_before_user_created('{"user":{"email":"old@example.ie","app_metadata":{"provider":"email"}}}') ? 'error', 'an expired allowance is refused');
select is(public.hook_before_user_created('{"user":{"email":"someone@gmail.com","app_metadata":{"provider":"google"}}}'), '{}'::jsonb, 'sign ups through an identity provider are not affected');

select pg_temp.login('a0000000-0000-4000-8000-000000000003');
select throws_ok($$select public.hook_before_user_created('{}'::jsonb)$$, '42501', null, 'clients cannot call the sign up hook');
select throws_ok('select * from public.signup_allowances', '42501', null, 'clients cannot read sign up allowances');
select throws_ok('select * from public.service_limits', '42501', null, 'clients cannot read service limits');
select throws_ok('select * from public.ai_daily_usage', '42501', null, 'clients cannot read AI usage');
select pg_temp.logout();

select * from finish();
rollback;
