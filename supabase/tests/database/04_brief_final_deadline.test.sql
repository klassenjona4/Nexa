-- Accepting a brief can set the project's final deadline to the brief's final submission date.
begin;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000011', 'deadline@example.ie', '{"full_name":"Dara Deadline"}');

create temp table fx (k text primary key, v uuid);
grant all on fx to public;
create function pg_temp.fx(p text) returns uuid language sql stable as $$ select v from fx where k = p $$;

select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-4000-8000-000000000011', 'role', 'authenticated')::text, true);
insert into fx select 'g', group_id from public.create_group_with_project('Cloud group', 'CS4028', 'Architecture', '2026-12-12T17:00:00Z');
insert into fx select 'p', id from public.projects where group_id = pg_temp.fx('g');
select set_config('request.jwt.claims', '', true);
select set_config('role', 'postgres', true);

insert into public.brief_analyses (project_id, source, status, result) values (pg_temp.fx('p'), 'text', 'ready', '{}');
insert into fx select 'a1', id from public.brief_analyses where project_id = pg_temp.fx('p');

select is(
  public.accept_brief(pg_temp.fx('p'), pg_temp.fx('a1'), '{"deadlines":[]}', '[{"title":"Report","due_at":"2027-03-20T17:00:00Z","estimated_hours":4}]', 'a0000000-0000-4000-8000-000000000011', '2027-03-27T23:59:00Z'),
  1, 'accepting the brief creates the tasks');
select is((select final_deadline from public.projects where id = pg_temp.fx('p')), '2027-03-27T23:59:00Z'::timestamptz, 'the final deadline is set to the brief''s date when chosen');

insert into public.brief_analyses (project_id, source, status, result) values (pg_temp.fx('p'), 'text', 'ready', '{}');
insert into fx select 'a2', id from public.brief_analyses where project_id = pg_temp.fx('p') and accepted_at is null;
select lives_ok(format('select public.accept_brief(%L, %L, %L, %L, %L)', pg_temp.fx('p'), pg_temp.fx('a2'), '{"deadlines":[]}', '[]', 'a0000000-0000-4000-8000-000000000011'), 'accepting without a deadline still works');
select is((select final_deadline from public.projects where id = pg_temp.fx('p')), '2027-03-27T23:59:00Z'::timestamptz, 'without a chosen date the final deadline is unchanged');

select * from finish();
rollback;
