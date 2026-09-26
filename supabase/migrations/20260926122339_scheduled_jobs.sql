-- Scheduled jobs. Supabase pg_cron calls the Nexa API through pg_net:
--   hourly: 48 hour task reminders
--   daily:  retention warnings and deletions, orphaned file and rate limit clean up
-- The API URL and the shared secret are read from Supabase Vault (secrets nexa_app_url and
-- nexa_cron_secret). Until both exist, the jobs do nothing. See README.md.

create or replace function private.call_cron_endpoint(p_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'nexa_app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'nexa_cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || p_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;
revoke all on function private.call_cron_endpoint from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('nexa-reminders', '7 * * * *', $job$select private.call_cron_endpoint('/api/cron/reminders')$job$);
    perform cron.schedule('nexa-retention', '23 3 * * *', $job$select private.call_cron_endpoint('/api/cron/retention')$job$);
  end if;
end;
$$;
