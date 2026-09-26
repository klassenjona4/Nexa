-- Private bucket for brief PDFs. No storage policies exist, so clients cannot read or write
-- objects directly. The server issues signed upload URLs and short lived signed read URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('briefs', 'briefs', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

-- Realtime: RLS applies to postgres_changes, so members only receive rows they can select.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.tasks, public.activity_log, public.task_links, public.brief_analyses;
  end if;
end;
$$;
