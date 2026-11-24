-- Event promo codes: a shared code that gives Premium (the monthly plan's features) for a fixed
-- number of days, without any payment. Additive only: new columns, new tables, new functions, and
-- new bodies for two existing functions with unchanged signatures.
--
-- Premium is computed, never stored as a flag: a user has it while billing_accounts.premium_until
-- is in the future. private.subscription_active() now also counts that, so every existing plan
-- rule (unlimited projects, the project allowance, AI usage) applies to promo Premium as well, and
-- Premium ends on its own without a scheduled job.
--
-- premium_until lives on billing_accounts, not profiles: members of a shared group can read each
-- other's profile rows, while billing_accounts is readable only by its owner and written only by
-- the server.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

alter table public.billing_accounts add column premium_until timestamptz;

-- Codes use an unambiguous alphabet without vowels: no 0/O, 1/I/L, and no readable words.
create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[B-DF-HJKMNP-TV-Z2-9]{10}$'),
  campaign text not null check (campaign ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  max_uses integer not null default 60 check (max_uses between 1 and 100000),
  uses integer not null default 0 check (uses >= 0),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  premium_days integer not null default 30 check (premium_days between 1 and 366),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint promo_codes_window check (valid_until > valid_from),
  constraint promo_codes_cap check (uses <= max_uses)
);
create index promo_codes_campaign_idx on public.promo_codes (campaign);

-- One redemption per user and campaign, also when a campaign's code is replaced.
create table public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  code_id uuid not null references public.promo_codes (id) on delete restrict,
  campaign text not null,
  redeemed_at timestamptz not null default now(),
  premium_until timestamptz not null,
  constraint promo_redemptions_once unique (user_id, campaign)
);
create index promo_redemptions_code_idx on public.promo_redemptions (code_id);

-- Consent to occasional emails about Nexa (GDPR Article 6(1)(a), Irish ePrivacy Regulation 13).
-- Holds the latest choice and when it was made. Never required for anything else.
create table public.marketing_consents (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_updates boolean not null,
  decided_at timestamptz not null default now(),
  source text not null check (source in ('redeem', 'account'))
);

-- ---------------------------------------------------------------------------
-- Access: promo tables are server only. Clients have no grants and there are no policies.
-- ---------------------------------------------------------------------------

alter table public.promo_codes enable row level security;
alter table public.promo_codes force row level security;
alter table public.promo_redemptions enable row level security;
alter table public.promo_redemptions force row level security;
alter table public.marketing_consents enable row level security;
alter table public.marketing_consents force row level security;

revoke all on table public.promo_codes, public.promo_redemptions, public.marketing_consents from public, anon, authenticated;
grant all on table public.promo_codes, public.promo_redemptions, public.marketing_consents to service_role;

-- Users may read their own consent record so the app can show the current choice.
grant select on public.marketing_consents to authenticated;
create policy marketing_consents_select_own on public.marketing_consents for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Premium in the existing plan rules
-- ---------------------------------------------------------------------------

-- A user has the monthly plan's features while Stripe is collecting a subscription, or while
-- Premium from a promo code has not ended.
create or replace function private.subscription_active(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.billing_accounts b
    where b.user_id = p_user
      and (
        (b.subscription_status in ('active', 'trialing', 'past_due')
          and (b.current_period_end is null or b.current_period_end > now()))
        or b.premium_until > now()
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Redemption (server only)
-- ---------------------------------------------------------------------------

-- Redeems a code for a user the server has authenticated. Raises promo_invalid for every reason a
-- code cannot be used (unknown, inactive, outside its window, used up), so the answer does not
-- reveal whether a code exists, and promo_already_redeemed when the user already has a
-- redemption in the campaign. Any error undoes the whole call, including the use count.
create or replace function public.redeem_promo_code(p_user uuid, p_code text)
returns table (premium_until timestamptz, premium_days integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
  c public.promo_codes;
  v_until timestamptz;
begin
  if p_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- The conditional update is the cap: concurrent calls queue on the row lock and each
  -- re-checks uses < max_uses against the committed count, so the cap cannot be exceeded.
  update public.promo_codes pc set uses = pc.uses + 1
  where pc.code = v_code
    and pc.active
    and now() >= pc.valid_from
    and now() < pc.valid_until
    and pc.uses < pc.max_uses
  returning pc.* into c;
  if not found then
    raise exception 'promo_invalid' using errcode = 'P0001';
  end if;

  insert into public.billing_accounts (user_id) values (p_user) on conflict do nothing;
  update public.billing_accounts b
    set premium_until = greatest(now(), coalesce(b.premium_until, now())) + make_interval(days => c.premium_days),
        updated_at = now()
    where b.user_id = p_user
    returning b.premium_until into v_until;
  if v_until is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  begin
    insert into public.promo_redemptions (user_id, code_id, campaign, premium_until)
    values (p_user, c.id, c.campaign, v_until);
  exception
    when unique_violation then
      raise exception 'promo_already_redeemed' using errcode = 'P0001';
  end;

  return query select v_until, c.premium_days;
end;
$$;

-- Reads a rate limit counter without counting a hit, so a route can refuse a request once a
-- limit is used up but count only failed attempts. Same fixed windows as rate_limit_hit.
create or replace function public.rate_limit_count(p_bucket text, p_window_seconds integer)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((
    select r.count from public.rate_limits r
    where r.bucket = p_bucket
      and r.window_start = to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds)
  ), 0);
$$;

-- Usage per campaign for the operator script.
create or replace function public.promo_campaign_status(p_campaign text)
returns table (code text, active boolean, uses integer, max_uses integer, valid_from timestamptz,
               valid_until timestamptz, premium_days integer, redemptions bigint, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select pc.code, pc.active, pc.uses, pc.max_uses, pc.valid_from, pc.valid_until, pc.premium_days,
         (select count(*) from public.promo_redemptions r where r.code_id = pc.id), pc.created_at
  from public.promo_codes pc
  where pc.campaign = p_campaign
  order by pc.created_at;
$$;

revoke all on function public.redeem_promo_code(uuid, text), public.rate_limit_count(text, integer),
  public.promo_campaign_status(text) from public, anon, authenticated;
grant execute on function public.redeem_promo_code(uuid, text), public.rate_limit_count(text, integer),
  public.promo_campaign_status(text) to service_role;

-- ---------------------------------------------------------------------------
-- Data export (GDPR Articles 15 and 20): adds Premium, redemptions and the email consent.
-- ---------------------------------------------------------------------------

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
                from public.calendar_feeds c where c.user_id = auth.uid()), '[]'::jsonb),
    'premium_until', (select b.premium_until from public.billing_accounts b where b.user_id = auth.uid()),
    'promo_redemptions', coalesce((select jsonb_agg(jsonb_build_object('campaign', r.campaign, 'redeemed_at', r.redeemed_at,
                'premium_until', r.premium_until) order by r.redeemed_at)
                from public.promo_redemptions r where r.user_id = auth.uid()), '[]'::jsonb),
    'email_updates_consent', (select jsonb_build_object('email_updates', mc.email_updates, 'decided_at', mc.decided_at, 'source', mc.source)
                from public.marketing_consents mc where mc.user_id = auth.uid())
  )
  where auth.uid() is not null;
$$;
