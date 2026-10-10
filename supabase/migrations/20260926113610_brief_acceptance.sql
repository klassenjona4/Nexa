-- Records when a reviewed brief analysis was turned into tasks, so it is accepted only once.
alter table public.brief_analyses add column accepted_at timestamptz;

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
  if not found or a.status <> 'ready' or a.accepted_at is not null then
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

  update public.brief_analyses set accepted_at = now() where id = p_analysis;
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

revoke all on function public.accept_brief from public, anon, authenticated;
grant execute on function public.accept_brief to service_role;
