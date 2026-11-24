
begin;

create or replace function public.submit_quiz_answer(
    p_assignment_id uuid,
    p_option_id uuid,
    p_guest_token_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_guest_id uuid;
    v_question_id uuid;
    v_quiz_date date;
    v_correct_option_id uuid;
    v_is_correct boolean;
    v_points integer;
    v_attempt_id uuid;
    v_current_streak integer;
    v_longest_streak integer;
begin
    v_user_id := auth.uid();

    if v_user_id is null and p_guest_token_hash is null then
        raise exception 'Sign in or provide a guest session';
    end if;

    select a.question_id, a.quiz_date, k.correct_option_id
    into v_question_id, v_quiz_date, v_correct_option_id
    from public.quiz_daily_assignments a
    join public.quiz_questions q on q.id = a.question_id
    join public.quiz_answer_keys k on k.question_id = q.id
    where a.id = p_assignment_id
      and a.is_published = true
      and q.status = 'published'
      and a.quiz_date = (now() at time zone 'Asia/Kathmandu')::date;

    if not found then
        raise exception 'No published quiz is available for today';
    end if;

    if not exists (
        select 1
        from public.quiz_options o
        where o.id = p_option_id
          and o.question_id = v_question_id
    ) then
        raise exception 'Invalid answer option';
    end if;

    if v_user_id is null then
        select id into v_guest_id
        from public.guest_quiz_sessions
        where token_hash = p_guest_token_hash
          and claimed_by is null
          and expires_at > now();

        if v_guest_id is null then
            raise exception 'Guest session is invalid or expired';
        end if;
    end if;

    v_is_correct := (p_option_id = v_correct_option_id);
    v_points := case when v_is_correct then 10 else 0 end;

    insert into public.quiz_attempts (
        assignment_id,
        question_id,
        user_id,
        guest_session_id,
        selected_option_id,
        is_correct,
        points_awarded
    )
    values (
        p_assignment_id,
        v_question_id,
        v_user_id,
        v_guest_id,
        p_option_id,
        v_is_correct,
        v_points
    )
    returning id into v_attempt_id;

    if v_user_id is not null then
        insert into public.user_stats (user_id)
        values (v_user_id)
        on conflict (user_id) do nothing;

        update public.user_stats
        set
            total_points = total_points + v_points,
            total_quiz_attempts = total_quiz_attempts + 1,
            correct_answers = correct_answers + case when v_is_correct then 1 else 0 end,
            current_streak = case
                when last_quiz_date = v_quiz_date then current_streak
                when last_quiz_date = v_quiz_date - 1 then current_streak + 1
                else 1
            end,
            longest_streak = greatest(
                longest_streak,
                case
                    when last_quiz_date = v_quiz_date then current_streak
                    when last_quiz_date = v_quiz_date - 1 then current_streak + 1
                    else 1
                end
            ),
            last_quiz_date = greatest(
                coalesce(last_quiz_date, v_quiz_date),
                v_quiz_date
            ),
            updated_at = now()
        where user_id = v_user_id
        returning current_streak, longest_streak
        into v_current_streak, v_longest_streak;

        -- Award streak badges. These award no extra points.
        insert into public.user_badges (user_id, badge_id)
        select v_user_id, b.id
        from public.badges b
        where b.code = case
            when v_current_streak >= 30 then 'streak_30'
            when v_current_streak >= 7 then 'streak_7'
            else null
        end
        on conflict (user_id, badge_id) do nothing;

        -- Award the 100-correct-answers milestone.
        insert into public.user_badges (user_id, badge_id)
        select v_user_id, b.id
        from public.badges b
        join public.user_stats s on s.user_id = v_user_id
        where b.code = 'correct_100'
          and s.correct_answers >= 100
        on conflict (user_id, badge_id) do nothing;
    end if;

    return jsonb_build_object(
        'attempt_id', v_attempt_id,
        'correct', v_is_correct,
        'points_awarded', v_points,
        'quiz_date', v_quiz_date,
        'message', case when v_is_correct
            then 'Correct answer!'
            else 'That answer is not correct.'
        end
    );

exception
    when unique_violation then
        raise exception 'You have already attempted this daily quiz';
end;
$$;

revoke all on function public.submit_quiz_answer(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function public.submit_quiz_answer(uuid, uuid, text)
to anon, authenticated;

commit;
