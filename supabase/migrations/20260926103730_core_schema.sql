-- Nexa core schema.
-- Every table has RLS enabled and forced in the RLS migration. Nothing here grants access.

create schema if not exists private;

create type public.member_role as enum ('owner', 'member');
create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.usage_kind as enum ('brief_breakdown', 'statement_generation');
create type public.invite_kind as enum ('link', 'email');
create type public.analysis_status as enum ('processing', 'ready', 'failed');
create type public.brief_source as enum ('pdf', 'text');
create type public.log_event as enum (
  'group_joined',
  'brief_uploaded',
  'tasks_created',
  'task_created',
  'task_status_changed',
  'task_assigned',
  'task_link_added',
  'task_confirmed',
  'task_flagged',
  'member_left',
  'member_removed'
);

-- Profiles hold only what the product needs: a display name. Email stays in auth.users.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  module_code text not null default '' check (char_length(module_code) <= 20),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  final_deadline timestamptz,
  plan text not null default 'free' check (char_length(plan) <= 40),
  brief jsonb check (brief is null or (jsonb_typeof(brief) = 'object' and octet_length(brief::text) <= 50000)),
  last_activity_at timestamptz not null default now(),
  deletion_warned_at timestamptz,
  created_at timestamptz not null default now()
);
create index projects_group_idx on public.projects (group_id);
create index projects_retention_idx on public.projects (greatest(last_activity_at, coalesce(final_deadline, last_activity_at)));

-- AI drafts wait here until a member reviews them. Written by the server only.
create table public.brief_analyses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source public.brief_source not null,
  storage_path text check (storage_path is null or char_length(storage_path) <= 200),
  file_name text check (file_name is null or char_length(file_name) <= 200),
  file_size integer check (file_size is null or file_size between 1 and 10485760),
  status public.analysis_status not null default 'processing',
  result jsonb check (result is null or (jsonb_typeof(result) = 'object' and octet_length(result::text) <= 100000)),
  error_code text check (error_code is null or char_length(error_code) <= 60),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index brief_analyses_project_idx on public.brief_analyses (project_id, created_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 4000),
  deliverable text not null default '' check (char_length(deliverable) <= 200),
  assignee_id uuid references public.profiles (id) on delete set null,
  due_at timestamptz,
  estimated_hours numeric(4, 1) not null default 1 check (estimated_hours >= 0 and estimated_hours <= 200),
  status public.task_status not null default 'todo',
  completion_seq integer not null default 0,
  position integer not null default 0 check (position between 0 and 100000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reminder_sent_at timestamptz
);
create index tasks_project_idx on public.tasks (project_id, position);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_reminder_idx on public.tasks (due_at) where reminder_sent_at is null and status <> 'done';

create table public.task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  url text not null check (char_length(url) between 9 and 2048 and url ~ '^https://[^\s/$.?#][^\s]*$'),
  host text not null default '' check (char_length(host) <= 255),
  label text not null default '' check (char_length(label) <= 200),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index task_links_task_idx on public.task_links (task_id);

-- Append only. See the RLS migration for the guard trigger and privileges.
create table public.activity_log (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  event public.log_event not null,
  task_id uuid,
  task_title text check (task_title is null or char_length(task_title) <= 200),
  completion_seq integer,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 4000),
  created_at timestamptz not null default now()
);
create index activity_log_project_idx on public.activity_log (project_id, created_at desc);
create index activity_log_task_idx on public.activity_log (task_id);
create index activity_log_actor_idx on public.activity_log (actor_id);
-- One confirmation or flag per reviewer per completion.
create unique index activity_log_one_review
  on public.activity_log (task_id, completion_seq, actor_id)
  where event in ('task_confirmed', 'task_flagged');

create table public.statements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  sections jsonb not null check (jsonb_typeof(sections) = 'array' and octet_length(sections::text) <= 60000),
  period_from timestamptz,
  period_to timestamptz,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles (id) on delete set null,
  edited_at timestamptz,
  edited_by uuid references public.profiles (id) on delete set null
);
create index statements_project_idx on public.statements (project_id, generated_at desc);

-- Tokens are derived on the server as HMAC(secret, nonce). Only sha256(token) is stored.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  kind public.invite_kind not null,
  email text check (email is null or char_length(email) <= 254),
  nonce bytea not null check (octet_length(nonce) = 16),
  code_hash bytea not null unique check (octet_length(code_hash) = 32),
  max_uses integer not null check (max_uses between 1 and 8),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'email') = (email is not null)),
  check (use_count <= max_uses)
);
create index invites_group_idx on public.invites (group_id);

create table public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  nonce bytea not null check (octet_length(nonce) = 16),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  created_at timestamptz not null default now(),
  last_read_at timestamptz,
  revoked_at timestamptz
);
create unique index calendar_feeds_one_active on public.calendar_feeds (user_id, project_id) where revoked_at is null;

-- Limits per plan. A paid tier is a new row here, not a schema change.
create table public.plan_limits (
  plan text not null,
  kind public.usage_kind not null,
  max_per_project integer not null check (max_per_project >= 0),
  primary key (plan, kind)
);

create table public.project_usage (
  project_id uuid not null references public.projects (id) on delete cascade,
  kind public.usage_kind not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (project_id, kind)
);

-- Buckets are HMACs of route plus IP or user id. No raw IP addresses are stored.
create table public.rate_limits (
  bucket text not null check (char_length(bucket) <= 128),
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);

insert into public.plan_limits (plan, kind, max_per_project) values
  ('free', 'brief_breakdown', 5),
  ('free', 'statement_generation', 5);
