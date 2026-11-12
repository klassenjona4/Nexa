-- The help chat has its own daily ceiling, separate from the AI ceiling for projects.
begin;
select no_plan();

delete from public.help_chat_daily_usage where day = current_date;
delete from public.ai_daily_usage where day = current_date;
update public.service_limits set max_value = 2 where name = 'help_chat_per_day';

set local role service_role;
select is(public.reserve_help_chat(), true, 'the first answer is counted');
select is(public.reserve_help_chat(), true, 'the second answer is counted');
select is(public.reserve_help_chat(), false, 'the daily ceiling holds');
select is((select used from public.help_chat_daily_usage where day = current_date), 2, 'refused requests are not counted');
select is((select count(*)::int from public.ai_daily_usage where day = current_date), 0, 'the project AI ceiling is not used by the help chat');
reset role;

set local role authenticated;
select throws_ok('select public.reserve_help_chat()', '42501', null, 'clients cannot call the counter');
select throws_ok('select * from public.help_chat_daily_usage', '42501', null, 'clients cannot read the counter');
reset role;
set local role anon;
select throws_ok('select public.reserve_help_chat()', '42501', null, 'visitors cannot call the counter');
reset role;

select * from finish();
rollback;
