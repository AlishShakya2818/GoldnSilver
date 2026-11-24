
begin;

alter table public.profiles
add column if not exists leaderboard_opt_in boolean not null default false;

create or replace function public.set_leaderboard_visibility(
    p_opt_in boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'You must be signed in';
    end if;

    update public.profiles
    set
        leaderboard_opt_in = p_opt_in,
        updated_at = now()
    where id = auth.uid();
end;
$$;

create or replace function public.get_quiz_leaderboard(
    p_period text default 'monthly',
    p_limit integer default 50
)
returns table (
    rank bigint,
    display_name text,
    username text,
    points bigint,
    correct_answers bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if p_period not in ('monthly', 'all_time') then
        raise exception 'Period must be monthly or all_time';
    end if;

    if p_limit < 1 or p_limit > 100 then
        raise exception 'Limit must be between 1 and 100';
    end if;

    if p_period = 'monthly' then
        return query
        select
            row_number() over (
                order by sum(qa.points_awarded) desc,
                         count(*) filter (where qa.is_correct) desc
            ),
            p.display_name,
            p.username,
            sum(qa.points_awarded)::bigint,
            count(*) filter (where qa.is_correct)::bigint
        from public.profiles p
        join public.quiz_attempts qa on qa.user_id = p.id
        join public.quiz_daily_assignments a on a.id = qa.assignment_id
        where p.leaderboard_opt_in = true
          and a.quiz_date >= date_trunc(
              'month',
              now() at time zone 'Asia/Kathmandu'
          )::date
          and a.quiz_date < (
              date_trunc('month', now() at time zone 'Asia/Kathmandu')
              + interval '1 month'
          )::date
        group by p.id, p.display_name, p.username
        order by sum(qa.points_awarded) desc,
                 count(*) filter (where qa.is_correct) desc
        limit p_limit;
    else
        return query
        select
            row_number() over (
                order by s.total_points desc, s.correct_answers desc
            ),
            p.display_name,
            p.username,
            s.total_points::bigint,
            s.correct_answers::bigint
        from public.profiles p
        join public.user_stats s on s.user_id = p.id
        where p.leaderboard_opt_in = true
        order by s.total_points desc, s.correct_answers desc
        limit p_limit;
    end if;
end;
$$;

revoke all on function public.set_leaderboard_visibility(boolean)
from public, anon, authenticated;

grant execute on function public.set_leaderboard_visibility(boolean)
to authenticated;

revoke all on function public.get_quiz_leaderboard(text, integer)
from public, anon, authenticated;

grant execute on function public.get_quiz_leaderboard(text, integer)
to anon, authenticated;

commit;
