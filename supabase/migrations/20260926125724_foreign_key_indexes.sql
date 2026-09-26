-- Covering indexes for foreign keys (Supabase performance advisor). They keep account and
-- project deletion fast when references are set to null or cascaded.
create index if not exists brief_analyses_created_by_idx on public.brief_analyses (created_by);
create index if not exists calendar_feeds_project_idx on public.calendar_feeds (project_id);
create index if not exists groups_created_by_idx on public.groups (created_by);
create index if not exists invites_created_by_idx on public.invites (created_by);
create index if not exists invites_project_idx on public.invites (project_id);
create index if not exists statements_edited_by_idx on public.statements (edited_by);
create index if not exists statements_generated_by_idx on public.statements (generated_by);
create index if not exists task_links_added_by_idx on public.task_links (added_by);
create index if not exists tasks_created_by_idx on public.tasks (created_by);
