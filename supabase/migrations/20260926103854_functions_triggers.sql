-- Helper functions, triggers and RPCs.
-- Every function that writes the activity log takes the actor from auth.uid(), never from a parameter.

-- ---------------------------------------------------------------------------
-- Membership helpers (private schema, not exposed through the API)
-- ---------------------------------------------------------------------------

create or replace function private.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_group_owner(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

create or replace function private.is_project_member(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    join public.group_members m on m.group_id = p.group_id
    where p.id = p_project and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_task_member(p_task uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    join public.projects p on p.id = t.project_id
    join public.group_members m on m.group_id = p.group_id
    where t.id = p_task and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.shares_group(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members a
    join public.group_members b on b.group_id = a.group_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  );
$$;

grant usage on schema private to authenticated, service_role;
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Activity log writer (internal). Also records project activity for retention.
-- ---------------------------------------------------------------------------

create or replace function private.write_log(
  p_project uuid,
  p_event public.log_event,
  p_task uuid default null,
  p_task_title text default null,
  p_completion_seq integer default null,
  p_payload jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_log (project_id, actor_id, event, task_id, task_title, completion_seq, payload)
  values (p_project, auth.uid(), p_event, p_task, left(p_task_title, 200), p_completion_seq, coalesce(p_payload, '{}'::jsonb));
  update public.projects set last_activity_at = now(), deletion_warned_at = null where id = p_project;
end;
$$;
revoke all on function private.write_log from public, authenticated;

create or replace function private.touch_project(p_project uuid)
returns void language sql security definer set search_path = '' as $$
  update public.projects set last_activity_at = now(), deletion_warned_at = null where id = p_project;
$$;
revoke all on function private.touch_project from public, authenticated;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 100)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Group membership rules: at most 8 members, at least one owner
-- ---------------------------------------------------------------------------

create or replace function private.group_members_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.groups where id = new.group_id for update;
  if (select count(*) from public.group_members where group_id = new.group_id) >= 8 then
    raise exception 'group_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger group_members_limit before insert on public.group_members
  for each row execute function private.group_members_limit();

create or replace function private.group_members_keep_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_group uuid := coalesce(old.group_id, new.group_id);
begin
  -- Cascaded deletes (group or account deletion) are handled by their own flows.
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if exists (select 1 from public.group_members where group_id = v_group)
     and not exists (select 1 from public.group_members where group_id = v_group and role = 'owner') then
    raise exception 'group_needs_owner' using errcode = 'P0001';
  end if;
  return null;
end;
$$;

create trigger group_members_keep_owner after update or delete on public.group_members
  for each row execute function private.group_members_keep_owner();

-- Log removals done by owners through the API. Leaving goes through leave_group().
create or replace function private.group_members_log_removal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_project uuid;
begin
  if pg_trigger_depth() > 1 or auth.uid() is null then
    return old;
  end if;
  -- Removed members lose their open tasks.
  update public.tasks t set assignee_id = null
  from public.projects p
  where p.id = t.project_id and p.group_id = old.group_id and t.assignee_id = old.user_id and t.status <> 'done';
  for v_project in select id from public.projects where group_id = old.group_id loop
    perform private.write_log(
      v_project,
      case when old.user_id = auth.uid() then 'member_left'::public.log_event else 'member_removed'::public.log_event end,
      null, null, null, jsonb_build_object('member_id', old.user_id)
    );
  end loop;
  return old;
end;
$$;

create trigger group_members_log_removal after delete on public.group_members
  for each row execute function private.group_members_log_removal();

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

create or replace function private.tasks_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_group uuid;
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.completion_seq := case when new.status = 'done' then 1 else 0 end;
    new.created_at := now();
    new.reminder_sent_at := null;
  else
    -- Fields that clients may never change.
    new.id := old.id;
    new.project_id := old.project_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.completion_seq := old.completion_seq;
    if new.status = 'done' and old.status <> 'done' then
      new.completion_seq := old.completion_seq + 1;
    end if;
    if new.due_at is distinct from old.due_at then
      new.reminder_sent_at := null;
    end if;
  end if;
  new.updated_at := now();

  if new.assignee_id is not null then
    select group_id into v_group from public.projects where id = new.project_id;
    if not exists (select 1 from public.group_members where group_id = v_group and user_id = new.assignee_id) then
      raise exception 'assignee_not_member' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_before_write before insert or update on public.tasks
  for each row execute function private.tasks_before_write();

create or replace function private.tasks_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(current_setting('nexa.bulk_tasks', true), '') <> 'on' then
      perform private.write_log(new.project_id, 'task_created', new.id, new.title, new.completion_seq, '{}'::jsonb);
    end if;
    return null;
  end if;

  if new.status is distinct from old.status then
    perform private.write_log(
      new.project_id, 'task_status_changed', new.id, new.title, new.completion_seq,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    perform private.write_log(
      new.project_id, 'task_assigned', new.id, new.title, new.completion_seq,
      jsonb_build_object('assignee_id', new.assignee_id)
    );
  end if;
  if new.status is not distinct from old.status and new.assignee_id is not distinct from old.assignee_id then
    perform private.touch_project(new.project_id);
  end if;
  return null;
end;
$$;

create trigger tasks_after_write after insert or update on public.tasks
  for each row execute function private.tasks_after_write();

-- ---------------------------------------------------------------------------
-- Task links
-- ---------------------------------------------------------------------------

create or replace function private.task_links_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.added_by := auth.uid();
  new.created_at := now();
  new.host := coalesce(left(lower(substring(new.url from '^https://([^/:?#]+)')), 255), '');
  if new.label is null or btrim(new.label) = '' then
    new.label := left(coalesce(nullif(regexp_replace(new.url, '^.*/([^/?#]+).*$', '\1'), new.url), new.host), 200);
  end if;
  return new;
end;
$$;

create trigger task_links_before_insert before insert on public.task_links
  for each row execute function private.task_links_before_insert();

create or replace function private.task_links_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t record;
begin
  select project_id, title, completion_seq into t from public.tasks where id = new.task_id;
  perform private.write_log(t.project_id, 'task_link_added', new.task_id, t.title, t.completion_seq,
    jsonb_build_object('label', new.label, 'host', new.host));
  return null;
end;
$$;

create trigger task_links_after_insert after insert on public.task_links
  for each row execute function private.task_links_after_insert();

-- ---------------------------------------------------------------------------
-- Statements: edits record who and when
-- ---------------------------------------------------------------------------

create or replace function private.statements_before_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
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

create trigger statements_before_update before update on public.statements
  for each row execute function private.statements_before_update();

-- ---------------------------------------------------------------------------
-- Activity log guard: no updates or deletes, except cascades
-- ---------------------------------------------------------------------------

create or replace function private.activity_log_guard()
returns trigger language plpgsql as $$
begin
  -- Depth 1 means a direct statement against the table. Foreign key cascades run at depth 2 or more.
  if pg_trigger_depth() <= 1 then
    raise exception 'activity_log_is_append_only' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    -- The only permitted change is actor_id set to null when an account is deleted.
    if new.actor_id is not null
       or (to_jsonb(new) - 'actor_id') is distinct from (to_jsonb(old) - 'actor_id') then
      raise exception 'activity_log_is_append_only' using errcode = '42501';
    end if;
    return new;
  end if;
  return old;
end;
$$;

create trigger activity_log_guard before update or delete on public.activity_log
  for each row execute function private.activity_log_guard();

create trigger activity_log_no_truncate before truncate on public.activity_log
  for each statement execute function private.activity_log_guard();

-- ---------------------------------------------------------------------------
-- RPCs for authenticated users (actor is always auth.uid())
-- ---------------------------------------------------------------------------

create or replace function public.create_group_with_project(
  p_group_name text,
  p_module_code text,
  p_title text,
  p_final_deadline timestamptz
) returns table (group_id uuid, project_id uuid)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_group uuid;
  v_project uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  insert into public.groups (name, created_by) values (btrim(p_group_name), v_uid) returning id into v_group;
  insert into public.group_members (group_id, user_id, role) values (v_group, v_uid, 'owner');
  insert into public.projects (group_id, module_code, title, final_deadline)
  values (v_group, btrim(coalesce(p_module_code, '')), btrim(p_title), p_final_deadline)
  returning id into v_project;
  perform private.write_log(v_project, 'group_joined');
  return query select v_group, v_project;
end;
$$;

create or replace function public.create_project(
  p_group uuid,
  p_module_code text,
  p_title text,
  p_final_deadline timestamptz
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_project uuid;
begin
  if not private.is_group_owner(p_group) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.projects (group_id, module_code, title, final_deadline)
  values (p_group, btrim(coalesce(p_module_code, '')), btrim(p_title), p_final_deadline)
  returning id into v_project;
  perform private.write_log(v_project, 'group_joined');
  return v_project;
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
  select id, project_id, title, status, assignee_id, completion_seq into t from public.tasks where id = p_task;
  if not found or not private.is_project_member(t.project_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if t.status <> 'done' then
    raise exception 'task_not_done' using errcode = 'P0001';
  end if;
  if t.assignee_id = v_uid then
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

create or replace function public.leave_group(p_group uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_next uuid;
begin
  if not private.is_group_member(p_group) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if private.is_group_owner(p_group)
     and not exists (select 1 from public.group_members where group_id = p_group and role = 'owner' and user_id <> v_uid) then
    select user_id into v_next from public.group_members
    where group_id = p_group and user_id <> v_uid order by joined_at, user_id limit 1;
    if v_next is null then
      -- Last member leaving: the group and its data are deleted.
      delete from public.groups where id = p_group;
      return;
    end if;
    update public.group_members set role = 'owner' where group_id = p_group and user_id = v_next;
  end if;
  delete from public.group_members where group_id = p_group and user_id = v_uid;
end;
$$;

create or replace function public.keep_project(p_project uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_project_member(p_project) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.touch_project(p_project);
end;
$$;

-- Members with email addresses, for group settings. Only co-members can call it.
create or replace function public.group_member_list(p_group uuid)
returns table (user_id uuid, full_name text, email text, role public.member_role, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.full_name, u.email::text, m.role, m.joined_at
  from public.group_members m
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.group_id = p_group and private.is_group_member(p_group)
  order by m.joined_at, m.user_id;
$$;

-- Full export of the caller's own data.
create or replace function public.export_my_data()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) || jsonb_build_object('email', u.email)
                from public.profiles p join auth.users u on u.id = p.id where p.id = auth.uid()),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('group_id', g.id, 'group_name', g.name, 'role', m.role, 'joined_at', m.joined_at))
                from public.group_members m join public.groups g on g.id = m.group_id where m.user_id = auth.uid()), '[]'::jsonb),
    'tasks_assigned_or_created', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'project_id', t.project_id, 'title', t.title,
                'description', t.description, 'status', t.status, 'due_at', t.due_at, 'estimated_hours', t.estimated_hours,
                'assigned_to_me', t.assignee_id = auth.uid(), 'created_by_me', t.created_by = auth.uid()))
                from public.tasks t where t.assignee_id = auth.uid() or t.created_by = auth.uid()), '[]'::jsonb),
    'file_links_added', coalesce((select jsonb_agg(jsonb_build_object('task_id', l.task_id, 'url', l.url, 'label', l.label, 'created_at', l.created_at))
                from public.task_links l where l.added_by = auth.uid()), '[]'::jsonb),
    'log_entries', coalesce((select jsonb_agg(jsonb_build_object('project_id', a.project_id, 'event', a.event, 'task_title', a.task_title,
                'payload', a.payload, 'created_at', a.created_at) order by a.created_at)
                from public.activity_log a where a.actor_id = auth.uid()), '[]'::jsonb),
    'statements_generated_or_edited', coalesce((select jsonb_agg(jsonb_build_object('project_id', s.project_id, 'sections', s.sections,
                'generated_at', s.generated_at, 'edited_at', s.edited_at))
                from public.statements s where s.generated_by = auth.uid() or s.edited_by = auth.uid()), '[]'::jsonb),
    'calendar_feeds', coalesce((select jsonb_agg(jsonb_build_object('project_id', c.project_id, 'created_at', c.created_at,
                'last_read_at', c.last_read_at, 'revoked_at', c.revoked_at))
                from public.calendar_feeds c where c.user_id = auth.uid()), '[]'::jsonb)
  )
  where auth.uid() is not null;
$$;

-- ---------------------------------------------------------------------------
-- Server-only RPCs (service_role). The server passes ids it verified from the JWT.
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

-- Reserve one unit of usage. Returns the new count, or null when the limit is reached.
create or replace function public.reserve_usage(p_project uuid, p_kind public.usage_kind)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
  v_used integer;
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
  return v_used;
end;
$$;

create or replace function public.release_usage(p_project uuid, p_kind public.usage_kind)
returns void language sql security definer set search_path = '' as $$
  update public.project_usage set used = greatest(used - 1, 0), updated_at = now()
  where project_id = p_project and kind = p_kind;
$$;

-- Fixed window counter. Returns true while the caller is within the limit.
create or replace function public.rate_limit_hit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits (bucket, window_start, count) values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_max;
end;
$$;

-- Records the brief upload and the bulk task creation after a member reviewed the AI draft.
create or replace function public.accept_brief(
  p_project uuid,
  p_analysis uuid,
  p_brief jsonb,
  p_tasks jsonb,
  p_actor uuid
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  a record;
  v_count integer := 0;
  t jsonb;
  v_pos integer := 0;
begin
  select * into a from public.brief_analyses where id = p_analysis and project_id = p_project for update;
  if not found or a.status <> 'ready' then
    raise exception 'analysis_not_ready' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.projects p join public.group_members m on m.group_id = p.group_id
    where p.id = p_project and m.user_id = p_actor
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  -- Run the writes as the actor so triggers record the right user.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_actor::text, true);

  update public.projects set brief = p_brief where id = p_project;
  perform private.write_log(p_project, 'brief_uploaded', null, null, null,
    case when a.file_name is not null then jsonb_build_object('file_name', a.file_name) else '{}'::jsonb end);

  select coalesce(max(position) + 1, 0) into v_pos from public.tasks where project_id = p_project;
  perform set_config('nexa.bulk_tasks', 'on', true);
  for t in select * from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) loop
    insert into public.tasks (project_id, title, description, deliverable, assignee_id, due_at, estimated_hours, position)
    values (
      p_project,
      t ->> 'title',
      coalesce(t ->> 'description', ''),
      coalesce(t ->> 'deliverable', ''),
      nullif(t ->> 'assignee_id', '')::uuid,
      nullif(t ->> 'due_at', '')::timestamptz,
      coalesce((t ->> 'estimated_hours')::numeric, 1),
      v_pos
    );
    v_pos := v_pos + 1;
    v_count := v_count + 1;
  end loop;
  perform set_config('nexa.bulk_tasks', 'off', true);
  if v_count > 0 then
    perform private.write_log(p_project, 'tasks_created', null, null, null, jsonb_build_object('count', v_count));
  end if;
  return v_count;
end;
$$;

-- Prepares account deletion: passes ownership on, deletes groups where the user is alone,
-- and unassigns open tasks. The server then deletes the auth user, which cascades.
create or replace function public.prepare_account_deletion(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  g record;
  v_next uuid;
begin
  for g in select m.group_id, m.role from public.group_members m where m.user_id = p_user loop
    if not exists (select 1 from public.group_members where group_id = g.group_id and user_id <> p_user) then
      delete from public.groups where id = g.group_id;
    elsif g.role = 'owner'
      and not exists (select 1 from public.group_members where group_id = g.group_id and role = 'owner' and user_id <> p_user) then
      select user_id into v_next from public.group_members
      where group_id = g.group_id and user_id <> p_user order by joined_at, user_id limit 1;
      update public.group_members set role = 'owner' where group_id = g.group_id and user_id = v_next;
    end if;
  end loop;
  update public.tasks set assignee_id = null where assignee_id = p_user and status <> 'done';
end;
$$;

-- Function privileges: nothing is callable by anon. Server-only functions are callable by service_role only.
revoke all on function public.create_group_with_project, public.create_project, public.review_task,
  public.leave_group, public.keep_project, public.group_member_list, public.export_my_data,
  public.accept_invite, public.reserve_usage, public.release_usage, public.rate_limit_hit,
  public.accept_brief, public.prepare_account_deletion
  from public, anon, authenticated;

grant execute on function public.create_group_with_project, public.create_project, public.review_task,
  public.leave_group, public.keep_project, public.group_member_list, public.export_my_data
  to authenticated;

grant execute on function public.accept_invite, public.reserve_usage, public.release_usage,
  public.rate_limit_hit, public.accept_brief, public.prepare_account_deletion
  to service_role;
