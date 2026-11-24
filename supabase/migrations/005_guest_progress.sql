
begin;

create or replace function public.claim_guest_quiz_progress(
    p_guest_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_guest_id uuid;
    v_claimed_count integer := 0;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'You must be signed in to claim guest progress';
    end if;

    if p_guest_token_hash is null or length(p_guest_token_hash) < 32 then
        raise exception 'Invalid guest session token';
    end if;

    select id into v_guest_id
    from public.guest_quiz_sessions
    where token_hash = p_guest_token_hash
      and claimed_by is null
      and expires_at > now()
    for update;

    if v_guest_id is null then
        raise exception 'Guest session is invalid, expired or already claimed';
    end if;

    -- Keep the registered attempt if the user already attempted
    -- the same daily assignment after creating their account.
    delete from public.quiz_attempts guest_attempt
    where guest_attempt.guest_session_id = v_guest_id
      and exists (
          select 1
          from public.quiz_attempts registered_attempt
          where registered_attempt.assignment_id = guest_attempt.assignment_id
            and registered_attempt.user_id = v_user_id
      );

    -- Transfer the remaining guest attempts.
    update public.quiz_attempts
    set
        user_id = v_user_id,
        guest_session_id = null
    where guest_session_id = v_guest_id;

    get diagnostics v_claimed_count = row_count;

    update public.guest_quiz_sessions
    set
        claimed_by = v_user_id,
        claimed_at = now()
    where id = v_guest_id;

    -- Recalculate account totals from its complete attempt history.
    insert into public.user_stats (user_id)
    values (v_user_id)
    on conflict (user_id) do nothing;

    with totals as (
        select
            count(*)::integer as attempts,
            count(*) filter (where is_correct)::integer as correct_count,
            coalesce(sum(points_awarded), 0)::integer as points
        from public.quiz_attempts
        where user_id = v_user_id
    ),
    daily_dates as (
        select distinct a.quiz_date
        from public.quiz_attempts qa
        join public.quiz_daily_assignments a
          on a.id = qa.assignment_id
        where qa.user_id = v_user_id
    ),
    streak_groups as (
        select
            quiz_date,
            quiz_date - (row_number() over (order by quiz_date))::integer as grp
        from daily_dates
    ),
    streaks as (
        select
            max(count(*))::integer as longest_streak
        from streak_groups
        group by grp
    ),
    current_run as (
        select count(*)::integer as current_streak
        from daily_dates
        where quiz_date >= (
            (now() at time zone 'Asia/Kathmandu')::date - 1
        )
          and quiz_date <= (now() at time zone 'Asia/Kathmandu')::date
          and quiz_date >= coalesce(
              (
                  select max(d2.quiz_date)
                  from daily_dates d2
                  where d2.quiz_date < (
                      (now() at time zone 'Asia/Kathmandu')::date - 1
                  )
              ) + 1,
              '-infinity'::date
          )
    )
    update public.user_stats s
    set
        total_points = totals.points,
        total_quiz_attempts = totals.attempts,
        correct_answers = totals.correct_count,
        longest_streak = greatest(
            coalesce((select max(longest_streak) from streaks), 0),
            coalesce(s.longest_streak, 0)
        ),
        current_streak = case
            when exists (
                select 1 from daily_dates
                where quiz_date = (now() at time zone 'Asia/Kathmandu')::date
            )
            or exists (
                select 1 from daily_dates
                where quiz_date = (now() at time zone 'Asia/Kathmandu')::date - 1
            )
            then (select current_streak from current_run)
            else 0
        end,
        last_quiz_date = (
            select max(quiz_date) from daily_dates
        ),
        updated_at = now()
    from totals
    where s.user_id = v_user_id;

    -- Award badges based on the newly recalculated statistics.
    insert into public.user_badges (user_id, badge_id)
    select v_user_id, b.id
    from public.badges b
    cross join public.user_stats s
    where s.user_id = v_user_id
      and (
          (b.code = 'streak_7' and s.longest_streak >= 7)
          or (b.code = 'streak_30' and s.longest_streak >= 30)
          or (b.code = 'correct_100' and s.correct_answers >= 100)
      )
    on conflict (user_id, badge_id) do nothing;

    return jsonb_build_object(
        'claimed_attempts', v_claimed_count,
        'message', 'Guest progress has been transferred to your account'
    );
end;
$$;

revoke all on function public.claim_guest_quiz_progress(text)
from public, anon, authenticated;

grant execute on function public.claim_guest_quiz_progress(text)
to authenticated;

commit;
