-- Server side helpers for the Stripe webhook. Service role only.

-- Adds one project credit after a paid 2 euro unlock that is not tied to a project.
create or replace function public.add_project_credit(p_user uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_credits integer;
begin
  insert into public.billing_accounts (user_id) values (p_user) on conflict do nothing;
  update public.billing_accounts
    set project_credits = project_credits + 1, updated_at = now()
    where user_id = p_user
    returning project_credits into v_credits;
  if v_credits is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_credits;
end;
$$;

revoke all on function public.add_project_credit(uuid) from public, anon, authenticated;
grant execute on function public.add_project_credit(uuid) to service_role;
