-- Row Level Security. Default deny: RLS is enabled and forced on every table, anon gets nothing,
-- and authenticated gets only the table and column privileges listed here.

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'groups', 'group_members', 'projects', 'brief_analyses', 'tasks', 'task_links',
    'activity_log', 'statements', 'invites', 'calendar_feeds', 'plan_limits', 'project_usage', 'rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end;
$$;

-- profiles --------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_group(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- groups ------------------------------------------------------------------------
grant select, delete on public.groups to authenticated;
grant update (name) on public.groups to authenticated;

create policy groups_select on public.groups for select to authenticated
  using (private.is_group_member(id));
create policy groups_update on public.groups for update to authenticated
  using (private.is_group_owner(id)) with check (private.is_group_owner(id));
create policy groups_delete on public.groups for delete to authenticated
  using (private.is_group_owner(id));

-- group_members ------------------------------------------------------------------
grant select, delete on public.group_members to authenticated;
grant update (role) on public.group_members to authenticated;

create policy group_members_select on public.group_members for select to authenticated
  using (private.is_group_member(group_id));
create policy group_members_update on public.group_members for update to authenticated
  using (private.is_group_owner(group_id)) with check (private.is_group_owner(group_id));
-- Owners remove others. Members leave through leave_group(), which handles ownership.
create policy group_members_delete on public.group_members for delete to authenticated
  using (private.is_group_owner(group_id) and user_id <> (select auth.uid()));

-- projects -----------------------------------------------------------------------
grant select, delete on public.projects to authenticated;
grant update (module_code, title, final_deadline) on public.projects to authenticated;

create policy projects_select on public.projects for select to authenticated
  using (private.is_group_member(group_id));
create policy projects_update on public.projects for update to authenticated
  using (private.is_group_member(group_id)) with check (private.is_group_member(group_id));
create policy projects_delete on public.projects for delete to authenticated
  using (private.is_group_owner(group_id));

-- brief_analyses (written by the server only) ------------------------------------
grant select on public.brief_analyses to authenticated;

create policy brief_analyses_select on public.brief_analyses for select to authenticated
  using (private.is_project_member(project_id));

-- tasks --------------------------------------------------------------------------
grant select, delete on public.tasks to authenticated;
grant update (title, description, deliverable, assignee_id, due_at, estimated_hours, status, position)
  on public.tasks to authenticated;
grant insert (project_id, title, description, deliverable, assignee_id, due_at, estimated_hours, status, position)
  on public.tasks to authenticated;

create policy tasks_select on public.tasks for select to authenticated
  using (private.is_project_member(project_id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (private.is_project_member(project_id));
create policy tasks_update on public.tasks for update to authenticated
  using (private.is_project_member(project_id)) with check (private.is_project_member(project_id));
create policy tasks_delete on public.tasks for delete to authenticated
  using (
    private.is_group_owner((select p.group_id from public.projects p where p.id = project_id))
    or (created_by = (select auth.uid()) and status = 'todo')
  );

-- task_links ---------------------------------------------------------------------
grant select on public.task_links to authenticated;
grant insert (task_id, url, label) on public.task_links to authenticated;

create policy task_links_select on public.task_links for select to authenticated
  using (private.is_task_member(task_id));
create policy task_links_insert on public.task_links for insert to authenticated
  with check (private.is_task_member(task_id));

-- activity_log: select only. No insert, update or delete policy exists. -------------
grant select on public.activity_log to authenticated;

create policy activity_log_select on public.activity_log for select to authenticated
  using (private.is_project_member(project_id));

-- statements ---------------------------------------------------------------------
grant select on public.statements to authenticated;
grant update (sections) on public.statements to authenticated;

create policy statements_select on public.statements for select to authenticated
  using (private.is_project_member(project_id));
create policy statements_update on public.statements for update to authenticated
  using (private.is_project_member(project_id)) with check (private.is_project_member(project_id));

-- invites (owners see and revoke; creation is server only) -------------------------
grant select (id, group_id, project_id, kind, email, max_uses, use_count, expires_at, revoked_at, created_by, created_at)
  on public.invites to authenticated;
grant update (revoked_at) on public.invites to authenticated;

create policy invites_select on public.invites for select to authenticated
  using (private.is_group_owner(group_id));
create policy invites_update on public.invites for update to authenticated
  using (private.is_group_owner(group_id)) with check (private.is_group_owner(group_id));

-- Revocation is one way: a revoked invite cannot be reactivated, and the time is set by the server.
create or replace function private.invites_before_update()
returns trigger language plpgsql as $$
begin
  if old.revoked_at is not null then
    new.revoked_at := old.revoked_at;
  elsif new.revoked_at is not null then
    new.revoked_at := now();
  end if;
  return new;
end;
$$;
create trigger invites_before_update before update on public.invites
  for each row execute function private.invites_before_update();

-- calendar_feeds (own rows, read only; writes are server only) ----------------------
grant select (id, user_id, project_id, created_at, last_read_at, revoked_at) on public.calendar_feeds to authenticated;

create policy calendar_feeds_select on public.calendar_feeds for select to authenticated
  using (user_id = (select auth.uid()));

-- plan_limits and project_usage (read only) ----------------------------------------
grant select on public.plan_limits to authenticated;
grant select on public.project_usage to authenticated;

create policy plan_limits_select on public.plan_limits for select to authenticated using (true);
create policy project_usage_select on public.project_usage for select to authenticated
  using (private.is_project_member(project_id));

-- rate_limits: no policies, no grants. Service role only. ------------------------------

-- Sequences behind identity columns are not needed by clients.
revoke all on all sequences in schema public from anon, authenticated;

-- New tables must opt in to access explicitly.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
