-- Help chat: its own daily ceiling, counted apart from brief breakdowns and statements so a busy
-- help chat can never use up the AI allowance of projects, and the other way round.

insert into public.service_limits (name, max_value) values ('help_chat_per_day', 1000)
on conflict (name) do nothing;

create table public.help_chat_daily_usage (
  day date primary key,
  used integer not null default 0 check (used >= 0)
);
alter table public.help_chat_daily_usage enable row level security;
alter table public.help_chat_daily_usage force row level security;
revoke all on table public.help_chat_daily_usage from anon, authenticated;
grant all on table public.help_chat_daily_usage to service_role;

-- Counts one help chat answer. Returns false when today's ceiling is reached.
create or replace function public.reserve_help_chat()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_max integer;
  v_used integer;
begin
  select max_value into v_max from public.service_limits where name = 'help_chat_per_day';
  if v_max is null then
    return true;
  end if;
  insert into public.help_chat_daily_usage as d (day, used) values (current_date, 1)
  on conflict (day) do update set used = d.used + 1 where d.used < v_max
  returning d.used into v_used;
  return v_used is not null and v_used <= v_max;
end;
$$;

revoke all on function public.reserve_help_chat() from public, anon, authenticated;
grant execute on function public.reserve_help_chat() to service_role;
