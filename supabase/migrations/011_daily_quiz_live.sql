-- Gold N Silver Rates - Migration 011
-- Live daily quiz, guest sessions, admin question management and starter content.
-- Run once in Supabase SQL Editor after migrations 001-010.

begin;

-- Create a guest session using only a SHA-256 hash. The raw token stays in the visitor's browser.
create or replace function public.create_guest_quiz_session(p_token_hash text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_expiry timestamptz;
begin
    if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
        raise exception 'Invalid guest token hash';
    end if;

    insert into public.guest_quiz_sessions(token_hash)
    values (p_token_hash)
    on conflict (token_hash) do update
      set expires_at = greatest(guest_quiz_sessions.expires_at, now() + interval '30 days')
    returning expires_at into v_expiry;

    return v_expiry;
end;
$$;

revoke all on function public.create_guest_quiz_session(text) from public, anon, authenticated;
grant execute on function public.create_guest_quiz_session(text) to anon, authenticated;

-- Read the result only for the signed-in user or the owner of the guest token.
create or replace function public.get_daily_quiz_result(
    p_assignment_id uuid,
    p_guest_token_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_result jsonb;
begin
    if auth.uid() is null and (p_guest_token_hash is null or p_guest_token_hash !~ '^[a-f0-9]{64}$') then
        raise exception 'A valid guest session or signed-in account is required';
    end if;

    select jsonb_build_object(
        'selected_option_id', qa.selected_option_id,
        'correct_option_id', ak.correct_option_id,
        'correct_answer', correct_option.option_text,
        'explanation', ak.explanation,
        'correct', qa.is_correct,
        'points_awarded', qa.points_awarded,
        'attempted_at', qa.attempted_at
    )
    into v_result
    from public.quiz_attempts qa
    join public.quiz_answer_keys ak on ak.question_id = qa.question_id
    join public.quiz_options correct_option
      on correct_option.id = ak.correct_option_id
     and correct_option.question_id = qa.question_id
    where qa.assignment_id = p_assignment_id
      and (
        (auth.uid() is not null and qa.user_id = auth.uid())
        or
        (auth.uid() is null and qa.guest_session_id in (
            select gs.id from public.guest_quiz_sessions gs
            where gs.token_hash = p_guest_token_hash
              and gs.claimed_by is null
              and gs.expires_at > now()
        ))
      )
    limit 1;

    return v_result;
end;
$$;

revoke all on function public.get_daily_quiz_result(uuid, text) from public, anon, authenticated;
grant execute on function public.get_daily_quiz_result(uuid, text) to anon, authenticated;

-- Aggregate guest progress without exposing guest-session rows.
create or replace function public.get_guest_quiz_stats(p_guest_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_result jsonb;
begin
    if p_guest_token_hash is null or p_guest_token_hash !~ '^[a-f0-9]{64}$' then
        raise exception 'Invalid guest session token';
    end if;

    with session_row as (
        select id from public.guest_quiz_sessions
        where token_hash = p_guest_token_hash
          and claimed_by is null
          and expires_at > now()
    ),
    dates as (
        select distinct a.quiz_date
        from public.quiz_attempts qa
        join public.quiz_daily_assignments a on a.id = qa.assignment_id
        join session_row gs on gs.id = qa.guest_session_id
    ),
    ranked as (
        select quiz_date,
               row_number() over (order by quiz_date desc) as rn
        from dates
    ),
    latest as (
        select max(quiz_date) as latest_date from dates
    ),
    streak as (
        select case
            when latest.latest_date >= (now() at time zone 'Asia/Kathmandu')::date - 1
            then (select count(*)::integer from ranked where quiz_date = latest.latest_date - (rn - 1)::integer)
            else 0
        end as current_streak
        from latest
    ),
    totals as (
        select count(*)::integer as attempts,
               count(*) filter (where qa.is_correct)::integer as correct_answers,
               coalesce(sum(qa.points_awarded), 0)::integer as total_points
        from public.quiz_attempts qa
        join session_row gs on gs.id = qa.guest_session_id
    )
    select jsonb_build_object(
        'total_points', totals.total_points,
        'total_quiz_attempts', totals.attempts,
        'correct_answers', totals.correct_answers,
        'current_streak', streak.current_streak
    )
    into v_result
    from totals cross join streak;

    return coalesce(v_result, jsonb_build_object(
        'total_points', 0,
        'total_quiz_attempts', 0,
        'correct_answers', 0,
        'current_streak', 0
    ));
end;
$$;

revoke all on function public.get_guest_quiz_stats(text) from public, anon, authenticated;
grant execute on function public.get_guest_quiz_stats(text) to anon, authenticated;

-- Admin-only create/update/schedule operation. Four options and answer key are saved atomically.
create or replace function public.admin_save_quiz_question(
    p_question_id uuid,
    p_question_text text,
    p_options jsonb,
    p_correct_position smallint,
    p_explanation text,
    p_quiz_date date,
    p_publish boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_question_id uuid;
    v_option_id uuid;
    v_correct_option_id uuid;
    v_position integer;
    v_option_text text;
    v_status public.content_status;
begin
    if auth.uid() is null or not public.is_admin() then
        raise exception 'Administrator permission required';
    end if;

    if char_length(trim(coalesce(p_question_text, ''))) not between 1 and 1000 then
        raise exception 'Question must contain between 1 and 1000 characters';
    end if;
    if p_options is null or jsonb_typeof(p_options) <> 'array' then
        raise exception 'Exactly four answer options are required';
    end if;
    if jsonb_array_length(p_options) <> 4 then
        raise exception 'Exactly four answer options are required';
    end if;
    if p_correct_position not between 1 and 4 then
        raise exception 'Choose a correct option';
    end if;
    if char_length(trim(coalesce(p_explanation, ''))) not between 1 and 1000 then
        raise exception 'An explanation is required';
    end if;
    if p_publish and p_quiz_date is null then
        raise exception 'Choose the date this question should appear';
    end if;
    if p_publish and p_quiz_date < (now() at time zone 'Asia/Kathmandu')::date then
        raise exception 'A question cannot be scheduled in the past';
    end if;

    if p_question_id is not null then
        if exists (select 1 from public.quiz_attempts where question_id = p_question_id) then
            raise exception 'This question already has attempts and can no longer be edited. Create a new question instead';
        end if;
        update public.quiz_questions
        set question_text = trim(p_question_text),
            status = case when p_publish then 'published'::public.content_status else 'draft'::public.content_status end,
            updated_at = now()
        where id = p_question_id
        returning id into v_question_id;
        if v_question_id is null then raise exception 'Question not found'; end if;
    else
        insert into public.quiz_questions(question_text, status, created_by)
        values (
            trim(p_question_text),
            case when p_publish then 'published'::public.content_status else 'draft'::public.content_status end,
            auth.uid()
        )
        returning id into v_question_id;
    end if;

    for v_position in 1..4 loop
        v_option_text := trim(p_options ->> (v_position - 1));
        if char_length(coalesce(v_option_text, '')) not between 1 and 300 then
            raise exception 'Each answer option must contain between 1 and 300 characters';
        end if;
        insert into public.quiz_options(question_id, option_text, position)
        values (v_question_id, v_option_text, v_position)
        on conflict (question_id, position)
        do update set option_text = excluded.option_text
        returning id into v_option_id;
        if v_position = p_correct_position then
            v_correct_option_id := v_option_id;
        end if;
    end loop;

    insert into public.quiz_answer_keys(question_id, correct_option_id, explanation)
    values (v_question_id, v_correct_option_id, trim(p_explanation))
    on conflict (question_id)
    do update set correct_option_id = excluded.correct_option_id,
                  explanation = excluded.explanation;

    if p_publish then
        if exists (
            select 1 from public.quiz_daily_assignments
            where quiz_date = p_quiz_date
              and question_id <> v_question_id
        ) then
            raise exception 'A different question is already scheduled for this date';
        end if;
        update public.quiz_daily_assignments
        set is_published = false, updated_at = now()
        where question_id = v_question_id and quiz_date <> p_quiz_date;
        insert into public.quiz_daily_assignments(question_id, quiz_date, is_published, created_by)
        values (v_question_id, p_quiz_date, true, auth.uid())
        on conflict (quiz_date)
        do update set is_published = true,
                      updated_at = now(),
                      created_by = auth.uid()
        where quiz_daily_assignments.question_id = excluded.question_id;
    else
        update public.quiz_daily_assignments
        set is_published = false, updated_at = now()
        where question_id = v_question_id;
    end if;

    return v_question_id;
end;
$$;

revoke all on function public.admin_save_quiz_question(uuid, text, jsonb, smallint, text, date, boolean) from public, anon, authenticated;
grant execute on function public.admin_save_quiz_question(uuid, text, jsonb, smallint, text, date, boolean) to authenticated;

create or replace function public.admin_delete_quiz_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null or not public.is_admin() then
        raise exception 'Administrator permission required';
    end if;
    if exists (select 1 from public.quiz_attempts where question_id = p_question_id) then
        raise exception 'This question has quiz attempts and cannot be deleted';
    end if;
    delete from public.quiz_daily_assignments where question_id = p_question_id;
    delete from public.quiz_questions where id = p_question_id;
    if not found then raise exception 'Question not found'; end if;
end;
$$;

revoke all on function public.admin_delete_quiz_question(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_quiz_question(uuid) to authenticated;

-- Quiz writes must go through the SECURITY DEFINER functions above, not direct browser table writes.
revoke insert, update, delete on table
    public.quiz_questions,
    public.quiz_options,
    public.quiz_answer_keys,
    public.quiz_daily_assignments,
    public.guest_quiz_sessions,
    public.quiz_attempts,
    public.user_stats,
    public.user_badges
from anon, authenticated;

-- Five starter questions. They are assigned one per day in Nepal time, beginning today.
do $$
declare
    r record;
    v_question_id uuid;
    v_option_id uuid;
    v_correct_option_id uuid;
    v_position integer;
    v_date date := (now() at time zone 'Asia/Kathmandu')::date;
begin
    for r in
        select * from (values
            (0, 'What does the karat measurement describe in gold?', array['The weight of the gold','The purity of the gold','The country where it was mined','The market price of the gold']::text[], 2, 'Karat measures the purity of gold. 24K is considered pure gold, while 22K contains approximately 91.6% gold.'),
            (1, 'How many grams are approximately equal to one tola?', array['10.0000 grams','11.6638 grams','12.5000 grams','15.0000 grams']::text[], 2, 'One standard tola is approximately 11.6638 grams, a measurement widely used in Nepal.'),
            (2, 'Which symbol is used for gold in the periodic table?', array['Ag','Fe','Au','Cu']::text[], 3, 'Au is the chemical symbol for gold, derived from the Latin word aurum.'),
            (3, 'Which factors can influence gold prices in Nepal?', array['International gold prices','Currency exchange rates','Local market conditions','All of the above']::text[], 4, 'International prices, exchange rates, import costs and local market conditions can all influence Nepal gold prices.'),
            (4, 'What is the chemical symbol for silver?', array['Si','Ag','Au','Al']::text[], 2, 'Ag is the chemical symbol for silver, derived from the Latin word argentum.')
        ) as starter(day_offset, question_text, options, correct_position, explanation)
    loop
        select id into v_question_id
        from public.quiz_questions
        where question_text = r.question_text
        order by created_at
        limit 1;

        if v_question_id is null then
            insert into public.quiz_questions(question_text, status)
            values (r.question_text, 'published')
            returning id into v_question_id;

            for v_position in 1..4 loop
                insert into public.quiz_options(question_id, option_text, position)
                values (v_question_id, r.options[v_position], v_position)
                returning id into v_option_id;
                if v_position = r.correct_position then
                    v_correct_option_id := v_option_id;
                end if;
            end loop;

            insert into public.quiz_answer_keys(question_id, correct_option_id, explanation)
            values (v_question_id, v_correct_option_id, r.explanation);
        end if;

        update public.quiz_questions set status = 'published' where id = v_question_id;
        insert into public.quiz_daily_assignments(question_id, quiz_date, is_published)
        values (v_question_id, v_date + r.day_offset, true)
        on conflict (quiz_date) do nothing;
    end loop;
end;
$$;

commit;
