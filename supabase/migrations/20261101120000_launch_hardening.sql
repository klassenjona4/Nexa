-- Launch hardening from the security audit of 1 November 2026.
--   1. Peer review integrity: the member who completed a task is recorded, cannot review it,
--      and a done task keeps its assignee (M-1). Account deletion works again for members who
--      created tasks or statements (foreign key cascades were undone by triggers).
--   2. Email invites can only be accepted by the invited address (M-2).
--   3. Quotas in the database, so they also hold for direct Supabase API calls (M-3).
--   4. A daily ceiling on AI requests across all projects (H-2).
--   5. Email sign ups only through the Nexa server, checked by a before-user-created Auth hook (M-6).

-- ---------------------------------------------------------------------------
-- 1. Peer review integrity and cascades
-- ---------------------------------------------------------------------------

alter table public.tasks add column completed_by uuid references public.profiles (id) on delete set null;
create index tasks_completed_by_idx on public.tasks (completed_by);

-- Backfill: whoever last marked each done task as done. Triggers are off so that only this
-- column changes.
alter table public.tasks disable trigger tasks_before_write;
alter table public.tasks disable trigger tasks_after_write;
update public.tasks t set completed_by = (
  select a.actor_id from public.activity_log a
  where a.task_id = t.id and a.event = 'task_status_changed' and a.payload ->> 'to' = 'done'
  order by a.created_at desc
  limit 1
)
where t.status = 'done';
alter table public.tasks enable trigger tasks_before_write;
alter table public.tasks enable trigger tasks_after_write;

-- pg_trigger_depth() is 1 for statements sent by clients and functions. Foreign key cascades
-- (account deletion sets created_by, assignee_id and completed_by to null) run deeper and are
-- left alone; resetting those columns there broke the cascade.
create or replace function private.tasks_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_group uuid;
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.completion_seq := case when new.status = 'done' then 1 else 0 end;
    new.completed_by := case when new.status = 'done' then auth.uid() end;
    new.created_at := now();
    new.reminder_sent_at := null;
  else
    -- Fields that clients may never change.
    new.id := old.id;
    new.project_id := old.project_id;
    new.created_at := old.created_at;
    new.completion_seq := old.completion_seq;
    if pg_trigger_depth() = 1 then
      new.created_by := old.created_by;
      new.completed_by := old.completed_by;
      -- A done task keeps its assignee, so nobody can hand it to a teammate, confirm it and take it back.
      if old.status = 'done' and new.status = 'done' and new.assignee_id is distinct from old.assignee_id then
        raise exception 'task_done_locked' using errcode = 'P0001';
      end if;
    end if;
    if new.status = 'done' and old.status <> 'done' then
      new.completion_seq := old.completion_seq + 1;
      new.completed_by := auth.uid();
    end if;
    if new.due_at is distinct from old.due_at then
      new.reminder_sent_at := null;
    end if;
  end if;
  new.updated_at := now();

  -- Checked when the assignee is set, so a done task whose assignee has left can still be edited.
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    select group_id into v_group from public.projects where id = new.project_id;
    if not exists (select 1 from public.group_members where group_id = v_group and user_id = new.assignee_id) then
      raise exception 'assignee_not_member' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.statements_before_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Foreign key cascades from account deletion only clear generated_by or edited_by.
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  new.id := old.id;
  new.project_id := old.project_id;
  new.generated_at := old.generated_at;
  new.generated_by := old.generated_by;
  new.period_from := old.period_from;
  new.period_to := old.period_to;
  new.edited_at := now();
  new.edited_by := auth.uid();
  perform private.touch_project(new.project_id);
  return new;
end;
$$;

create or replace function public.review_task(p_task uuid, p_kind text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  t record;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select id, project_id, title, status, assignee_id, completed_by, completion_seq into t from public.tasks where id = p_task;
  if not found or not private.is_project_member(t.project_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if t.status <> 'done' then
    raise exception 'task_not_done' using errcode = 'P0001';
  end if;
  -- Neither the assignee nor the member who marked the task as done can review it.
  if v_uid = t.assignee_id or v_uid = t.completed_by then
    raise exception 'own_task' using errcode = 'P0001';
  end if;
  if p_kind = 'confirmed' then
    perform private.write_log(t.project_id, 'task_confirmed', t.id, t.title, t.completion_seq, '{}'::jsonb);
  elsif p_kind = 'flagged' then
    if char_length(v_note) not between 1 and 1000 then
      raise exception 'invalid_note' using errcode = 'P0001';
    end if;
    perform private.write_log(t.project_id, 'task_flagged', t.id, t.title, t.completion_seq, jsonb_build_object('note', v_note));
  else
    raise exception 'invalid_kind' using errcode = 'P0001';
  end if;
exception
  when unique_violation then
    raise exception 'already_reviewed' using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Email invites belong to the invited address
-- ---------------------------------------------------------------------------

create or replace function public.accept_invite(p_code_hash bytea, p_user uuid)
returns table (group_id uuid, project_id uuid, already_member boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  i record;
begin
  select * into i from public.invites where code_hash = p_code_hash for update;
  if not found or i.revoked_at is not null or i.expires_at <= now() then
    raise exception 'invite_invalid' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.group_members m where m.group_id = i.group_id and m.user_id = p_user) then
    return query select i.group_id, i.project_id, true;
    return;
  end if;
  if i.kind = 'email'
     and lower(i.email) is distinct from (select lower(u.email) from auth.users u where u.id = p_user) then
    raise exception 'invite_wrong_account' using errcode = 'P0001';
  end if;
  if i.use_count >= i.max_uses then
    raise exception 'invite_used_up' using errcode = 'P0001';
  end if;
  update public.invites set use_count = use_count + 1 where id = i.id;
  insert into public.group_members (group_id, user_id, role) values (i.group_id, p_user, 'member');
  insert into public.activity_log (project_id, actor_id, event) values (i.project_id, p_user, 'group_joined');
  update public.projects set last_activity_at = now(), deletion_warned_at = null where id = i.project_id;
  return query select i.group_id, i.project_id, false;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Quotas
-- ---------------------------------------------------------------------------

-- At most 10 new groups per member per day.
create or replace function private.groups_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is not null then
    perform 1 from public.profiles where id = v_uid for update;
    if (select count(*) from public.groups where created_by = v_uid and created_at > now() - interval '1 day') >= 10 then
      raise exception 'group_limit' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger groups_quota before insert on public.groups
  for each row execute function private.groups_quota();

-- At most 10 projects per group.
create or replace function private.projects_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.groups where id = new.group_id for update;
  if (select count(*) from public.projects where group_id = new.group_id) >= 10 then
    raise exception 'project_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger projects_quota before insert on public.projects
  for each row execute function private.projects_quota();

-- At most 300 tasks per project.
create or replace function private.tasks_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.projects where id = new.project_id for update;
  if (select count(*) from public.tasks where project_id = new.project_id) >= 300 then
    raise exception 'task_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger tasks_quota before insert on public.tasks
  for each row execute function private.tasks_quota();

-- At most 50 links per task.
create or replace function private.task_links_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.tasks where id = new.task_id for update;
  if (select count(*) from public.task_links where task_id = new.task_id) >= 50 then
    raise exception 'link_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger task_links_quota before insert on public.task_links
  for each row execute function private.task_links_quota();

-- Every change a member makes through the board writes a log entry. At most 600 entries per
-- member per hour, the same budget as the API's write limit, so the log cannot be flooded.
create index activity_log_actor_created_idx on public.activity_log (actor_id, created_at);
drop index public.activity_log_actor_idx;

create or replace function private.write_log(
  p_project uuid,
  p_event public.log_event,
  p_task uuid default null,
  p_task_title text default null,
  p_completion_seq integer default null,
  p_payload jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is not null
     and (select count(*) from public.activity_log where actor_id = v_actor and created_at > now() - interval '1 hour') >= 600 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.activity_log (project_id, actor_id, event, task_id, task_title, completion_seq, payload)
  values (p_project, v_actor, p_event, p_task, left(p_task_title, 200), p_completion_seq, coalesce(p_payload, '{}'::jsonb));
  update public.projects set last_activity_at = now(), deletion_warned_at = null where id = p_project;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Daily ceiling on AI requests across all projects
-- ---------------------------------------------------------------------------

-- Operator settings, server only. Change a value with an update; no deploy needed.
create table public.service_limits (
  name text primary key check (char_length(name) <= 60),
  max_value integer not null check (max_value >= 0)
);
insert into public.service_limits (name, max_value) values ('ai_requests_per_day', 500);

create table public.ai_daily_usage (
  day date primary key,
  used integer not null default 0 check (used >= 0)
);

alter table public.service_limits enable row level security;
alter table public.service_limits force row level security;
alter table public.ai_daily_usage enable row level security;
alter table public.ai_daily_usage force row level security;
revoke all on table public.service_limits, public.ai_daily_usage from anon, authenticated;
grant all on table public.service_limits, public.ai_daily_usage to service_role;

-- Reserve one unit of usage. Returns the new count, or null when the project limit is reached.
-- Raises ai_daily_limit when the daily ceiling across all projects is reached.
create or replace function public.reserve_usage(p_project uuid, p_kind public.usage_kind)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
  v_used integer;
  v_daily_max integer;
  v_daily integer;
begin
  select l.max_per_project into v_limit
  from public.projects p join public.plan_limits l on l.plan = p.plan and l.kind = p_kind
  where p.id = p_project;
  if v_limit is null then
    return null;
  end if;
  insert into public.project_usage (project_id, kind, used) values (p_project, p_kind, 0)
  on conflict do nothing;
  update public.project_usage set used = used + 1, updated_at = now()
  where project_id = p_project and kind = p_kind and used < v_limit
  returning used into v_used;
  if v_used is null then
    return null;
  end if;

  select max_value into v_daily_max from public.service_limits where name = 'ai_requests_per_day';
  if v_daily_max is not null then
    insert into public.ai_daily_usage as d (day, used) values (current_date, 1)
    on conflict (day) do update set used = d.used + 1 where d.used < v_daily_max
    returning d.used into v_daily;
    if v_daily is null or v_daily > v_daily_max then
      -- Raising also undoes the project reservation above.
      raise exception 'ai_daily_limit' using errcode = 'P0001';
    end if;
  end if;
  return v_used;
end;
$$;

create or replace function public.release_usage(p_project uuid, p_kind public.usage_kind)
returns void language sql security definer set search_path = '' as $$
  update public.project_usage set used = greatest(used - 1, 0), updated_at = now()
  where project_id = p_project and kind = p_kind;
  update public.ai_daily_usage set used = greatest(used - 1, 0) where day = current_date;
$$;

-- ---------------------------------------------------------------------------
-- 5. Email sign ups only through the Nexa server
-- ---------------------------------------------------------------------------

-- The sign in route writes a short lived allowance for an address just before it asks Supabase
-- Auth to create the account. Direct calls to Supabase Auth have no allowance and are refused.
create table public.signup_allowances (
  email text primary key check (char_length(email) <= 254),
  expires_at timestamptz not null
);
alter table public.signup_allowances enable row level security;
alter table public.signup_allowances force row level security;
revoke all on table public.signup_allowances from anon, authenticated;
grant all on table public.signup_allowances to service_role;

-- Enable in the dashboard: Authentication, Hooks, Before User Created, Postgres function
-- public.hook_before_user_created. Locally it is enabled in supabase/config.toml.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_provider text := coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', 'email');
  v_email text := lower(event -> 'user' ->> 'email');
begin
  -- Identity providers such as Google prove the address themselves.
  if v_provider not in ('email', 'phone') then
    return '{}'::jsonb;
  end if;
  if v_email is not null and exists (
    select 1 from public.signup_allowances where email = v_email and expires_at > now()
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Sign up through the Nexa app.'));
end;
$$;
revoke all on function public.hook_before_user_created from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema public to supabase_auth_admin;
    grant execute on function public.hook_before_user_created to supabase_auth_admin;
  end if;
end;
$$;
