-- Plans and billing.
--
-- Free plan: 1 project per user with 1 brief breakdown and 1 contribution statement.
-- Project unlock (2 euro, one off): 1 more project with 3 breakdowns and 3 statements, or 3 more
--   of each on an existing project.
-- Monthly plan (7.99 euro): unlimited projects; AI use per project is capped by a fair use limit.
--
-- A project is paid for by the member who creates it (projects.funded_by). Members who join use the
-- project's allowance and spend nothing of their own. All rules are enforced here, in the database,
-- so they hold whatever the client sends. Billing rows are written only by the server (service role)
-- after a verified Stripe webhook.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.billing_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id text unique check (stripe_customer_id is null or char_length(stripe_customer_id) <= 100),
  subscription_id text unique check (subscription_id is null or char_length(subscription_id) <= 100),
  subscription_status text check (subscription_status is null or subscription_status in
    ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  project_credits integer not null default 0 check (project_credits between 0 and 1000),
  free_project_used boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per completed one off payment, for the account page and support.
create table public.billing_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  stripe_session_id text not null unique check (char_length(stripe_session_id) <= 200),
  kind text not null check (kind in ('project_credit', 'project_unlock')),
  project_id uuid references public.projects (id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (char_length(currency) = 3),
  created_at timestamptz not null default now()
);
create index billing_purchases_user_idx on public.billing_purchases (user_id, created_at desc);
create index billing_purchases_project_idx on public.billing_purchases (project_id);

-- Stripe event ids already handled, so a retried webhook is applied once.
create table public.stripe_events (
  id text primary key check (char_length(id) <= 100),
  type text not null check (char_length(type) <= 100),
  received_at timestamptz not null default now()
);

alter table public.projects
  add column funded_by uuid references public.profiles (id) on delete set null,
  add column unlocks integer not null default 0 check (unlocks between 0 and 100);
create index projects_funded_by_idx on public.projects (funded_by);
-- projects.plan already exists: 'free', 'project' (paid with a credit) or 'subscription'.
alter table public.projects add constraint projects_plan_known check (plan in ('free', 'project', 'subscription'));

-- Limits per plan. 'unlock' is what each 2 euro unlock adds to an existing project.
-- 'subscription' is the fair use cap behind "unlimited".
update public.plan_limits set max_per_project = 1 where plan = 'free';
insert into public.plan_limits (plan, kind, max_per_project) values
  ('project', 'brief_breakdown', 3),
  ('project', 'statement_generation', 3),
  ('unlock', 'brief_breakdown', 3),
  ('unlock', 'statement_generation', 3),
  ('subscription', 'brief_breakdown', 30),
  ('subscription', 'statement_generation', 30)
on conflict (plan, kind) do update set max_per_project = excluded.max_per_project;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.billing_accounts enable row level security;
alter table public.billing_accounts force row level security;
alter table public.billing_purchases enable row level security;
alter table public.billing_purchases force row level security;
alter table public.stripe_events enable row level security;
alter table public.stripe_events force row level security;

revoke all on table public.billing_accounts, public.billing_purchases, public.stripe_events from anon, authenticated;
grant select on public.billing_accounts to authenticated;
grant select on public.billing_purchases to authenticated;
grant all on table public.billing_accounts, public.billing_purchases, public.stripe_events to service_role;

create policy billing_accounts_select_own on public.billing_accounts for select to authenticated
  using (user_id = (select auth.uid()));
create policy billing_purchases_select_own on public.billing_purchases for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------

-- A subscription counts while Stripe is collecting it, including retries after a failed payment.
create or replace function private.subscription_active(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.billing_accounts b
    where b.user_id = p_user
      and b.subscription_status in ('active', 'trialing', 'past_due')
      and (b.current_period_end is null or b.current_period_end > now())
  );
$$;

-- Decides how a new project is paid for. Runs before every project insert.
create or replace function private.projects_entitlement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  b public.billing_accounts;
begin
  -- Server side inserts without a session (seed data, tests) keep the plan they set.
  if v_uid is null then
    return new;
  end if;
  insert into public.billing_accounts (user_id) values (v_uid) on conflict do nothing;
  select * into b from public.billing_accounts where user_id = v_uid for update;
  new.funded_by := v_uid;
  new.unlocks := 0;
  if private.subscription_active(v_uid) then
    new.plan := 'subscription';
  elsif not b.free_project_used then
    new.plan := 'free';
    update public.billing_accounts set free_project_used = true, updated_at = now() where user_id = v_uid;
  elsif b.project_credits > 0 then
    new.plan := 'project';
    update public.billing_accounts set project_credits = project_credits - 1, updated_at = now() where user_id = v_uid;
  else
    raise exception 'plan_project_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger projects_entitlement before insert on public.projects
  for each row execute function private.projects_entitlement();

-- The allowance of one kind on a project, or null when the project has none at all.
create or replace function private.project_limit(p_project uuid, p_kind public.usage_kind)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare
  p record;
  v_base integer;
  v_unlock integer;
begin
  select plan, funded_by, unlocks into p from public.projects where id = p_project;
  if not found then
    return null;
  end if;
  if p.plan = 'subscription' and not private.subscription_active(p.funded_by) then
    return 0;
  end if;
  select max_per_project into v_base from public.plan_limits where plan = p.plan and kind = p_kind;
  select max_per_project into v_unlock from public.plan_limits where plan = 'unlock' and kind = p_kind;
  return coalesce(v_base, 0) + p.unlocks * coalesce(v_unlock, 0);
end;
$$;

-- Reserve one unit of usage. Returns the new count, or null when the project limit is reached.
-- Raises subscription_inactive when the project depends on a subscription that has ended, and
-- ai_daily_limit when the daily ceiling across all projects is reached.
create or replace function public.reserve_usage(p_project uuid, p_kind public.usage_kind)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
  v_used integer;
  v_daily_max integer;
  v_daily integer;
  v_plan text;
begin
  select plan into v_plan from public.projects where id = p_project;
  v_limit := private.project_limit(p_project, p_kind);
  if v_limit is null then
    return null;
  end if;
  if v_plan = 'subscription' and v_limit = 0 then
    raise exception 'subscription_inactive' using errcode = 'P0001';
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

-- What members see: the allowance of a project they belong to.
create or replace function public.project_allowance(p_project uuid)
returns table (kind public.usage_kind, used integer, max integer, unlimited boolean, plan text, subscription_active boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  p record;
begin
  select pr.plan, pr.funded_by into p from public.projects pr
  where pr.id = p_project and private.is_project_member(pr.id);
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return query
    select k.kind,
           coalesce((select u.used from public.project_usage u where u.project_id = p_project and u.kind = k.kind), 0),
           private.project_limit(p_project, k.kind),
           p.plan = 'subscription',
           p.plan,
           case when p.plan = 'subscription' then private.subscription_active(p.funded_by) else null end
    from (values ('brief_breakdown'::public.usage_kind), ('statement_generation'::public.usage_kind)) as k(kind);
end;
$$;

-- What a user sees about their own plan before creating a project.
create or replace function public.my_entitlements()
returns table (subscription_active boolean, free_project_available boolean, project_credits integer)
language sql stable security definer set search_path = '' as $$
  select private.subscription_active(auth.uid()),
         not coalesce((select b.free_project_used from public.billing_accounts b where b.user_id = auth.uid()), false),
         coalesce((select b.project_credits from public.billing_accounts b where b.user_id = auth.uid()), 0)
  where auth.uid() is not null;
$$;

-- Server only: applies a paid unlock to an existing project. A project that depended on an ended
-- subscription becomes a paid project with a fresh allowance; any other project gains one unlock.
create or replace function public.apply_project_unlock(p_project uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_plan text;
begin
  select pr.plan into v_plan from public.projects pr
  join public.group_members m on m.group_id = pr.group_id and m.user_id = p_user
  where pr.id = p_project
  for update of pr;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_plan = 'subscription' then
    update public.projects set plan = 'project', unlocks = 0, funded_by = p_user where id = p_project;
    delete from public.project_usage where project_id = p_project;
  else
    update public.projects set unlocks = unlocks + 1 where id = p_project;
  end if;
end;
$$;

revoke all on function private.subscription_active, private.projects_entitlement, private.project_limit from public, anon, authenticated;
revoke all on function public.reserve_usage, public.apply_project_unlock from public, anon, authenticated;
grant execute on function public.reserve_usage, public.apply_project_unlock to service_role;
revoke all on function public.project_allowance, public.my_entitlements from public, anon;
grant execute on function public.project_allowance, public.my_entitlements to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Existing data
-- ---------------------------------------------------------------------------

-- Every existing project is paid for by the member who created its group and stays on the
-- free plan. Its creator's free project is used.
update public.projects pr set funded_by = g.created_by
from public.groups g where g.id = pr.group_id and pr.funded_by is null;
insert into public.billing_accounts (user_id, free_project_used)
select p.id, exists (select 1 from public.projects pr where pr.funded_by = p.id)
from public.profiles p
on conflict (user_id) do nothing;
