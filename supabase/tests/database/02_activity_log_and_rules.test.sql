-- Proves the activity log is append only, that entries carry auth.uid() as the actor,
-- and that the group, review, invite and usage rules hold.
begin;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'owner@example.ie', '{"full_name":"Aoife Owner"}'),
  ('a0000000-0000-4000-8000-000000000002', 'cian@example.ie', '{"full_name":"Cian Member"}'),
  ('a0000000-0000-4000-8000-000000000003', 'niamh@example.ie', '{"full_name":"Niamh Member"}'),
  ('d0000000-0000-4000-8000-000000000001', 'd1@example.ie', '{}'),
  ('d0000000-0000-4000-8000-000000000002', 'd2@example.ie', '{}'),
  ('d0000000-0000-4000-8000-000000000003', 'd3@example.ie', '{}'),
  ('d0000000-0000-4000-8000-000000000004', 'd4@example.ie', '{}'),
  ('d0000000-0000-4000-8000-000000000005', 'd5@example.ie', '{}'),
  ('d0000000-0000-4000-8000-000000000006', 'd6@example.ie', '{}');

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

select pg_temp.login('a0000000-0000-4000-8000-000000000001');
insert into fx select 'g', group_id from public.create_group_with_project('Media Law group 4', 'MDIA7012', 'Assignment 2', now() + interval '40 days');
insert into fx select 'p', id from public.projects where group_id = pg_temp.fx('g');
select pg_temp.logout();

-- Invites -----------------------------------------------------------------------
insert into public.invites (group_id, project_id, kind, nonce, code_hash, max_uses)
  values (pg_temp.fx('g'), pg_temp.fx('p'), 'link', gen_random_bytes(16), sha256('good-code'), 2);
insert into public.invites (group_id, project_id, kind, nonce, code_hash, max_uses, expires_at)
  values (pg_temp.fx('g'), pg_temp.fx('p'), 'link', gen_random_bytes(16), sha256('expired-code'), 5, now() - interval '1 minute');
insert into public.invites (group_id, project_id, kind, nonce, code_hash, max_uses, revoked_at)
  values (pg_temp.fx('g'), pg_temp.fx('p'), 'link', gen_random_bytes(16), sha256('revoked-code'), 5, now());
insert into public.invites (group_id, project_id, kind, nonce, code_hash, max_uses)
  values (pg_temp.fx('g'), pg_temp.fx('p'), 'link', gen_random_bytes(16), sha256('big-code'), 8);

set local role service_role;
select is((select already_member from public.accept_invite(sha256('good-code'), 'a0000000-0000-4000-8000-000000000002')), false, 'a valid invite adds the user');
select is((select already_member from public.accept_invite(sha256('good-code'), 'a0000000-0000-4000-8000-000000000002')), true, 'accepting twice does not use the invite again');
select is((select already_member from public.accept_invite(sha256('good-code'), 'a0000000-0000-4000-8000-000000000003')), false, 'second use of a two-use invite works');
select throws_ok(format('select * from public.accept_invite(%L, %L)', sha256('good-code'), 'd0000000-0000-4000-8000-000000000001'), 'P0001', 'invite_used_up', 'an invite stops at its maximum use count');
select throws_ok(format('select * from public.accept_invite(%L, %L)', sha256('expired-code'), 'd0000000-0000-4000-8000-000000000001'), 'P0001', 'invite_invalid', 'an expired invite is rejected');
select throws_ok(format('select * from public.accept_invite(%L, %L)', sha256('revoked-code'), 'd0000000-0000-4000-8000-000000000001'), 'P0001', 'invite_invalid', 'a revoked invite is rejected');
select throws_ok(format('select * from public.accept_invite(%L, %L)', sha256('unknown'), 'd0000000-0000-4000-8000-000000000001'), 'P0001', 'invite_invalid', 'an unknown code is rejected');
select lives_ok(format('select * from public.accept_invite(%L, %L)', sha256('big-code'), 'd0000000-0000-4000-8000-00000000000' || n), 'member ' || n || ' joins')
  from generate_series(1, 5) n;
select throws_ok(format('select * from public.accept_invite(%L, %L)', sha256('big-code'), 'd0000000-0000-4000-8000-000000000006'), 'P0001', 'group_full', 'a group is limited to 8 members');
select pg_temp.logout();

-- Revocation is one way.
insert into fx select 'rev', id from public.invites where code_hash = sha256('revoked-code');
select pg_temp.login('a0000000-0000-4000-8000-000000000001');
update public.invites set revoked_at = null where id = pg_temp.fx('rev');
select isnt((select revoked_at from public.invites where id = pg_temp.fx('rev')), null, 'a revoked invite cannot be reactivated');
select pg_temp.logout();

-- Remove the extra members again (as the owner, through RLS).
select pg_temp.login('a0000000-0000-4000-8000-000000000001');
select is(pg_temp.affected($q$delete from public.group_members where group_id = pg_temp.fx('g') and user_id::text like 'd0000000%'$q$), 5, 'owner can remove members');
select is((select count(*)::int from public.activity_log where event = 'member_removed' and actor_id = 'a0000000-0000-4000-8000-000000000001'), 5, 'removals are logged with the owner as actor');

-- Tasks and triggered log entries ----------------------------------------------------
insert into public.tasks (project_id, title, assignee_id, estimated_hours)
  values (pg_temp.fx('p'), 'Research case law', 'a0000000-0000-4000-8000-000000000002', 6);
insert into fx select 't', id from public.tasks where title = 'Research case law';
select is((select created_by from public.tasks where id = pg_temp.fx('t')), 'a0000000-0000-4000-8000-000000000001'::uuid, 'created_by comes from auth.uid()');
select is((select count(*)::int from public.activity_log where event = 'task_created' and task_id = pg_temp.fx('t') and actor_id = 'a0000000-0000-4000-8000-000000000001'), 1, 'task creation is logged with the right actor');
select pg_temp.logout();

select pg_temp.login('a0000000-0000-4000-8000-000000000002');
update public.tasks set status = 'done' where id = pg_temp.fx('t');
select is((select completion_seq from public.tasks where id = pg_temp.fx('t')), 1, 'marking done increments the completion counter');
select is((select actor_id from public.activity_log where event = 'task_status_changed' and task_id = pg_temp.fx('t')), 'a0000000-0000-4000-8000-000000000002'::uuid, 'status change is logged with the member as actor');
insert into public.task_links (task_id, url) values (pg_temp.fx('t'), 'https://docs.google.com/document/d/case-law-summary');
select is((select added_by from public.task_links where task_id = pg_temp.fx('t')), 'a0000000-0000-4000-8000-000000000002'::uuid, 'link author comes from auth.uid()');
select is((select host from public.task_links where task_id = pg_temp.fx('t')), 'docs.google.com', 'link host is derived on the server');
select throws_ok(format('insert into public.task_links (task_id, url) values (%L, %L)', pg_temp.fx('t'), 'javascript:alert(1)'), '23514', null, 'only https links are accepted');
select throws_ok(format('select public.review_task(%L, %L)', pg_temp.fx('t'), 'confirmed'), 'P0001', 'own_task', 'a member cannot confirm their own task');
select pg_temp.logout();

select pg_temp.login('a0000000-0000-4000-8000-000000000003');
select lives_ok(format('select public.review_task(%L, %L)', pg_temp.fx('t'), 'confirmed'), 'a teammate can confirm a completed task');
select throws_ok(format('select public.review_task(%L, %L)', pg_temp.fx('t'), 'confirmed'), 'P0001', 'already_reviewed', 'a teammate reviews once per completion');
select pg_temp.logout();

select pg_temp.login('a0000000-0000-4000-8000-000000000001');
select throws_ok(format('select public.review_task(%L, %L, %L)', pg_temp.fx('t'), 'flagged', '  '), 'P0001', 'invalid_note', 'a flag needs a reason');
select lives_ok(format('select public.review_task(%L, %L, %L)', pg_temp.fx('t'), 'flagged', 'Two cases are older than 2015.'), 'a teammate can flag a completed task');
select is((select payload ->> 'note' from public.activity_log where event = 'task_flagged'), 'Two cases are older than 2015.', 'the flag reason is recorded');

-- Append only, for clients ---------------------------------------------------------
select throws_ok(format('insert into public.activity_log (project_id, actor_id, event) values (%L, %L, %L)', pg_temp.fx('p'), 'a0000000-0000-4000-8000-000000000002', 'task_confirmed'), '42501', null, 'clients cannot insert log entries directly');
select throws_ok('update public.activity_log set payload = ''{}''', '42501', null, 'clients cannot update log entries');
select throws_ok('delete from public.activity_log', '42501', null, 'clients cannot delete log entries');
update public.tasks set status = 'in_progress' where id = pg_temp.fx('t');
select throws_ok(format('select public.review_task(%L, %L)', pg_temp.fx('t'), 'confirmed'), 'P0001', 'task_not_done', 'only completed tasks can be reviewed');
select pg_temp.logout();

-- Append only, even for privileged roles ----------------------------------------------
select throws_ok('update public.activity_log set payload = ''{}''', '42501', 'activity_log_is_append_only', 'even the database owner cannot update log entries');
select throws_ok('delete from public.activity_log', '42501', 'activity_log_is_append_only', 'even the database owner cannot delete log entries');
select throws_ok('truncate public.activity_log', '42501', 'activity_log_is_append_only', 'the log cannot be truncated');
select throws_ok('update public.activity_log set actor_id = null', '42501', 'activity_log_is_append_only', 'actor ids cannot be cleared by hand');

-- Owners and roles -----------------------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000001');
select throws_ok(format('update public.group_members set role = %L where user_id = %L', 'member', 'a0000000-0000-4000-8000-000000000001'), 'P0001', 'group_needs_owner', 'the last owner cannot step down');
select is(pg_temp.affected($q$delete from public.group_members where user_id = 'a0000000-0000-4000-8000-000000000001'$q$), 0, 'owners leave through leave_group, not a direct delete');
select lives_ok(format('select public.leave_group(%L)', pg_temp.fx('g')), 'the only owner can leave');
select pg_temp.logout();
select is((select role::text from public.group_members where user_id = 'a0000000-0000-4000-8000-000000000002'), 'owner', 'ownership passes to the longest standing member');

-- Account deletion keeps log entries as Former member --------------------------------
set local role service_role;
select lives_ok($$select public.prepare_account_deletion('a0000000-0000-4000-8000-000000000002')$$, 'account deletion preparation runs');
select pg_temp.logout();
select is((select role::text from public.group_members where user_id = 'a0000000-0000-4000-8000-000000000003'), 'owner', 'ownership passes on before account deletion');
delete from auth.users where id = 'a0000000-0000-4000-8000-000000000002';
select is((select count(*)::int from public.activity_log where event = 'task_status_changed' and actor_id is null), 1, 'log entries of a deleted account remain without an actor');
select is((select count(*)::int from public.profiles where id = 'a0000000-0000-4000-8000-000000000002'), 0, 'the profile is deleted');

-- Usage limits --------------------------------------------------------------------
set local role service_role;
select is(public.reserve_usage(pg_temp.fx('p'), 'statement_generation'), n, 'statement generation ' || n || ' of 5 is allowed')
  from generate_series(1, 5) n;
select is(public.reserve_usage(pg_temp.fx('p'), 'statement_generation'), null, 'the sixth statement generation is refused');
select lives_ok(format('select public.release_usage(%L, %L)', pg_temp.fx('p'), 'statement_generation'), 'a failed call releases its reservation');
select is(public.reserve_usage(pg_temp.fx('p'), 'statement_generation'), 5, 'the released unit can be used again');

-- Rate limits -----------------------------------------------------------------------
select is(public.rate_limit_hit('bucket-1', 2, 3600), true, 'first request is allowed');
select is(public.rate_limit_hit('bucket-1', 2, 3600), true, 'second request is allowed');
select is(public.rate_limit_hit('bucket-1', 2, 3600), false, 'third request is refused');
select pg_temp.logout();

-- Group deletion cascades the log -----------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000003');
select is(pg_temp.affected($q$delete from public.groups where id = pg_temp.fx('g')$q$), 1, 'an owner can delete the group');
select pg_temp.logout();
select is((select count(*)::int from public.activity_log where project_id = pg_temp.fx('p')), 0, 'deleting the group deletes its log');

select * from finish();
rollback;
