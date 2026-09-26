-- Fix the search_path of trigger functions flagged by the Supabase security advisor.
alter function private.set_updated_at() set search_path = '';
alter function private.activity_log_guard() set search_path = '';
alter function private.invites_before_update() set search_path = '';
