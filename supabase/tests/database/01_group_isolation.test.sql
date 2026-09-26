-- Proves that a user cannot read or write another group's data, and that anonymous users read nothing.
begin;
select no_plan();

-- Fixtures -------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'owner.a@example.ie', '{"full_name":"Aoife Owner"}'),
  ('a0000000-0000-4000-8000-000000000002', 'member.a@example.ie', '{"full_name":"Cian Member"}'),
  ('b0000000-0000-4000-8000-000000000001', 'owner.b@example.ie', '{"full_name":"Brian Other"}'),
  ('c0000000-0000-4000-8000-000000000001', 'nobody@example.ie', '{}');

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
create function pg_temp.affected(p_sql text) returns integer language plpgsql as $$
declare
  n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;
create function pg_temp.fx(p text) returns uuid language sql stable as $$ select v from fx where k = p $$;

-- Group A, created by its owner through the RPC.
select pg_temp.login('a0000000-0000-4000-8000-000000000001');
insert into fx select 'ga', group_id from public.create_group_with_project('Group A', 'MDIA7012', 'Assignment A', now() + interval '40 days');
insert into fx select 'pa', id from public.projects where group_id = pg_temp.fx('ga');
select pg_temp.logout();
insert into public.group_members (group_id, user_id) values (pg_temp.fx('ga'), 'a0000000-0000-4000-8000-000000000002');
select pg_temp.login('a0000000-0000-4000-8000-000000000001');
insert into public.tasks (project_id, title, assignee_id) values (pg_temp.fx('pa'), 'Task in A', 'a0000000-0000-4000-8000-000000000002');
insert into fx select 'ta', id from public.tasks where project_id = pg_temp.fx('pa');
insert into public.task_links (task_id, url) values (pg_temp.fx('ta'), 'https://docs.google.com/document/d/abc');
select pg_temp.logout();

-- Group B.
select pg_temp.login('b0000000-0000-4000-8000-000000000001');
insert into fx select 'gb', group_id from public.create_group_with_project('Group B', 'DGTL8003', 'Assignment B', null);
insert into fx select 'pb', id from public.projects where group_id = pg_temp.fx('gb');
insert into public.tasks (project_id, title) values (pg_temp.fx('pb'), 'Task in B');
select pg_temp.logout();

-- Server-written rows for group A.
insert into public.statements (project_id, sections) values (pg_temp.fx('pa'), '[{"heading":"Summary","body":"Text"}]');
insert into public.brief_analyses (project_id, source, status) values (pg_temp.fx('pa'), 'text', 'ready');
insert into public.invites (group_id, project_id, kind, nonce, code_hash, max_uses)
  values (pg_temp.fx('ga'), pg_temp.fx('pa'), 'link', gen_random_bytes(16), gen_random_bytes(32), 7);
insert into public.calendar_feeds (user_id, project_id, nonce, token_hash)
  values ('a0000000-0000-4000-8000-000000000001', pg_temp.fx('pa'), gen_random_bytes(16), gen_random_bytes(32));
select public.reserve_usage(pg_temp.fx('pa'), 'brief_breakdown');
select public.rate_limit_hit('test-bucket', 5, 60);

-- Outsider (owner of group B) reading group A --------------------------------------
select pg_temp.login('b0000000-0000-4000-8000-000000000001');

select is((select count(*)::int from public.groups where id = pg_temp.fx('ga')), 0, 'outsider cannot read another group');
select is((select count(*)::int from public.group_members where group_id = pg_temp.fx('ga')), 0, 'outsider cannot read another group''s members');
select is((select count(*)::int from public.projects where id = pg_temp.fx('pa')), 0, 'outsider cannot read another group''s project');
select is((select count(*)::int from public.tasks where project_id = pg_temp.fx('pa')), 0, 'outsider cannot read another group''s tasks');
select is((select count(*)::int from public.task_links where task_id = pg_temp.fx('ta')), 0, 'outsider cannot read another group''s file links');
select is((select count(*)::int from public.activity_log where project_id = pg_temp.fx('pa')), 0, 'outsider cannot read another group''s log');
select is((select count(*)::int from public.statements where project_id = pg_temp.fx('pa')), 0, 'outsider cannot read another group''s statement');
select is((select count(*)::int from public.brief_analyses where project_id = pg_temp.fx('pa')), 0, 'outsider cannot read another group''s brief analysis');
select is((select count(*)::int from public.invites where group_id = pg_temp.fx('ga')), 0, 'outsider cannot read another group''s invites');
select is((select count(*)::int from public.calendar_feeds where project_id = pg_temp.fx('pa')), 0, 'outsider cannot read another user''s calendar feeds');
select is((select count(*)::int from public.project_usage where project_id = pg_temp.fx('pa')), 0, 'outsider cannot read another project''s usage');
select is((select count(*)::int from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'), 0, 'outsider cannot read profiles of people in other groups');
select is((select count(*)::int from public.group_member_list(pg_temp.fx('ga'))), 0, 'outsider gets no member list for another group');
select throws_ok('select * from public.rate_limits', '42501', null, 'clients cannot read rate limits');

-- Outsider writing group A ------------------------------------------------------
select is(pg_temp.affected($q$update public.groups set name = 'Taken' where id = pg_temp.fx('ga')$q$), 0, 'outsider cannot rename another group');
select is(pg_temp.affected($q$update public.projects set title = 'Taken' where id = pg_temp.fx('pa')$q$), 0, 'outsider cannot edit another project');
select is(pg_temp.affected($q$update public.tasks set title = 'Taken' where project_id = pg_temp.fx('pa')$q$), 0, 'outsider cannot edit another group''s tasks');
select is(pg_temp.affected($q$update public.statements set sections = '[]' where project_id = pg_temp.fx('pa')$q$), 0, 'outsider cannot edit another group''s statement');
select is(pg_temp.affected($q$update public.invites set revoked_at = now() where group_id = pg_temp.fx('ga')$q$), 0, 'outsider cannot revoke another group''s invites');
select is(pg_temp.affected($q$update public.group_members set role = 'member' where group_id = pg_temp.fx('ga')$q$), 0, 'outsider cannot change roles in another group');
select is(pg_temp.affected($q$delete from public.tasks where project_id = pg_temp.fx('pa')$q$), 0, 'outsider cannot delete another group''s tasks');
select is(pg_temp.affected($q$delete from public.projects where id = pg_temp.fx('pa')$q$), 0, 'outsider cannot delete another project');
select is(pg_temp.affected($q$delete from public.groups where id = pg_temp.fx('ga')$q$), 0, 'outsider cannot delete another group');
select is(pg_temp.affected($q$delete from public.group_members where group_id = pg_temp.fx('ga')$q$), 0, 'outsider cannot remove members of another group');
select throws_ok(format('insert into public.tasks (project_id, title) values (%L, %L)', pg_temp.fx('pa'), 'Injected'), '42501', null, 'outsider cannot add tasks to another group');
select throws_ok(format('insert into public.task_links (task_id, url) values (%L, %L)', pg_temp.fx('ta'), 'https://example.com/x'), '42501', null, 'outsider cannot add file links to another group''s task');
select throws_ok(format('insert into public.group_members (group_id, user_id) values (%L, %L)', pg_temp.fx('ga'), 'b0000000-0000-4000-8000-000000000001'), '42501', null, 'outsider cannot add themselves to a group');
select throws_ok(format('select public.review_task(%L, %L)', pg_temp.fx('ta'), 'confirmed'), 'P0002', 'not_found', 'outsider cannot review another group''s task');
select throws_ok(format('select public.keep_project(%L)', pg_temp.fx('pa')), 'P0002', 'not_found', 'outsider cannot touch another project');
select throws_ok(format('select public.leave_group(%L)', pg_temp.fx('ga')), 'P0002', 'not_found', 'outsider cannot leave a group they are not in');
select throws_ok(format('select public.create_project(%L, %L, %L, null)', pg_temp.fx('ga'), 'X', 'Injected'), 'P0002', 'not_found', 'outsider cannot create projects in another group');
select throws_ok(format('update public.tasks set assignee_id = %L where project_id = %L', 'a0000000-0000-4000-8000-000000000001', pg_temp.fx('pb')), 'P0001', 'assignee_not_member', 'tasks cannot be assigned to someone outside the group');

-- Server-only functions are not callable by clients.
select throws_ok(format('select * from public.accept_invite(%L::bytea, %L)', '\x00', 'b0000000-0000-4000-8000-000000000001'), '42501', null, 'clients cannot call accept_invite');
select throws_ok(format('select public.reserve_usage(%L, %L)', pg_temp.fx('pb'), 'brief_breakdown'), '42501', null, 'clients cannot reserve usage');
select throws_ok(format('select public.release_usage(%L, %L)', pg_temp.fx('pb'), 'brief_breakdown'), '42501', null, 'clients cannot release usage');
select throws_ok('select public.rate_limit_hit(''x'', 1, 60)', '42501', null, 'clients cannot touch rate limits');
select throws_ok(format('select public.accept_brief(%L, %L, %L, %L, %L)', pg_temp.fx('pb'), pg_temp.fx('pb'), '{}', '[]', 'b0000000-0000-4000-8000-000000000001'), '42501', null, 'clients cannot call accept_brief');
select throws_ok(format('select public.prepare_account_deletion(%L)', 'a0000000-0000-4000-8000-000000000001'), '42501', null, 'clients cannot call prepare_account_deletion');

-- Columns that clients can never set, even in their own group.
select throws_ok(format('update public.projects set plan = %L where id = %L', 'pro', pg_temp.fx('pb')), '42501', null, 'members cannot change the plan');
select throws_ok(format('update public.tasks set created_by = %L where project_id = %L', 'a0000000-0000-4000-8000-000000000001', pg_temp.fx('pb')), '42501', null, 'members cannot change task authorship');
select throws_ok(format('update public.tasks set completion_seq = 9 where project_id = %L', pg_temp.fx('pb')), '42501', null, 'members cannot change completion counters');
select throws_ok('update public.project_usage set used = 0', '42501', null, 'members cannot reset usage');
select throws_ok('update public.plan_limits set max_per_project = 999', '42501', null, 'members cannot change plan limits');
select throws_ok('select code_hash from public.invites', '42501', null, 'invite hashes are not readable');
select throws_ok('select token_hash from public.calendar_feeds', '42501', null, 'calendar token hashes are not readable');
select throws_ok(format('insert into public.statements (project_id, sections) values (%L, %L)', pg_temp.fx('pb'), '[]'), '42501', null, 'members cannot insert statements directly');
select throws_ok(format('insert into public.brief_analyses (project_id, source) values (%L, %L)', pg_temp.fx('pb'), 'text'), '42501', null, 'members cannot insert AI results directly');
select pg_temp.logout();

-- Plain member of group A --------------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.projects where id = pg_temp.fx('pa')), 1, 'member can read own project');
select is((select count(*)::int from public.tasks where project_id = pg_temp.fx('pa')), 1, 'member can read own tasks');
select is((select count(*)::int from public.profiles), 2, 'member sees profiles of co-members only');
select is((select count(*)::int from public.group_member_list(pg_temp.fx('ga'))), 2, 'member sees the member list with emails');
select is((select count(*)::int from public.invites), 0, 'members who are not owners cannot see invites');
select is((select count(*)::int from public.calendar_feeds), 0, 'member cannot see the owner''s calendar feed');
select is(pg_temp.affected($q$update public.group_members set role = 'owner' where user_id = 'a0000000-0000-4000-8000-000000000002'$q$), 0, 'member cannot promote themselves');
select is(pg_temp.affected($q$delete from public.groups where id = pg_temp.fx('ga')$q$), 0, 'member cannot delete the group');
select is(pg_temp.affected($q$update public.profiles set full_name = 'Changed' where id = 'a0000000-0000-4000-8000-000000000001'$q$), 0, 'member cannot edit someone else''s profile');
select is(pg_temp.affected($q$update public.profiles set full_name = 'Cian M' where id = 'a0000000-0000-4000-8000-000000000002'$q$), 1, 'member can edit own profile');
select pg_temp.logout();

-- User in no group --------------------------------------------------------------
select pg_temp.login('c0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.groups), 0, 'user without groups reads no groups');
select is((select count(*)::int from public.tasks), 0, 'user without groups reads no tasks');
select is((select count(*)::int from public.activity_log), 0, 'user without groups reads no log');
select is((select count(*)::int from public.profiles), 1, 'user without groups reads only their own profile');
select pg_temp.logout();

-- Anonymous --------------------------------------------------------------------
set local role anon;
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.groups', '42501', null, 'anon cannot read groups');
select throws_ok('select * from public.projects', '42501', null, 'anon cannot read projects');
select throws_ok('select * from public.tasks', '42501', null, 'anon cannot read tasks');
select throws_ok('select * from public.activity_log', '42501', null, 'anon cannot read the log');
select throws_ok('select * from public.invites', '42501', null, 'anon cannot read invites');
select throws_ok('select * from public.calendar_feeds', '42501', null, 'anon cannot read calendar feeds');
select throws_ok('select * from public.statements', '42501', null, 'anon cannot read statements');
select throws_ok('select public.create_group_with_project(''x'', '''', ''y'', null)', '42501', null, 'anon cannot create groups');
select pg_temp.logout();

-- Every table in public has RLS enabled and forced.
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not (c.relrowsecurity and c.relforcerowsecurity)),
  0, 'every public table has RLS enabled and forced');

select * from finish();
rollback;
