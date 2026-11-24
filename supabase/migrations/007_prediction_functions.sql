
begin;

-- Submit a prediction for an open round.
create or replace function public.submit_prediction(
    p_round_id uuid,
    p_choice public.prediction_choice
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_prediction_id uuid;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'You must sign in to participate';
    end if;

    if not exists (
        select 1
        from public.prediction_rounds
        where id = p_round_id
          and status = 'open'
          and now() < closes_at
    ) then
        raise exception 'This prediction round is not accepting entries';
    end if;

    insert into public.predictions (
        round_id,
        user_id,
        choice
    )
    values (
        p_round_id,
        v_user_id,
        p_choice
    )
    returning id into v_prediction_id;

    return v_prediction_id;

exception
    when unique_violation then
        raise exception 'You have already submitted a prediction for this round';
end;
$$;


-- Admin-only settlement using a verified provider price.
create or replace function public.settle_prediction_round(
    p_round_id uuid,
    p_settlement_price numeric
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_round public.prediction_rounds%rowtype;
    v_correct_choice public.prediction_choice;
    v_count integer;
begin
    if auth.uid() is null or not public.is_admin() then
        raise exception 'Administrator permission required';
    end if;

    if p_settlement_price <= 0 then
        raise exception 'Settlement price must be greater than zero';
    end if;

    select * into v_round
    from public.prediction_rounds
    where id = p_round_id
    for update;

    if not found then
        raise exception 'Prediction round not found';
    end if;

    if v_round.status not in ('open', 'closed') then
        raise exception 'This round cannot be settled';
    end if;

    if now() < v_round.closes_at then
        raise exception 'The prediction round has not closed yet';
    end if;

    if p_settlement_price > v_round.opening_price then
        v_correct_choice := 'higher';
    elsif p_settlement_price < v_round.opening_price then
        v_correct_choice := 'lower';
    else
        v_correct_choice := null;
    end if;

    update public.predictions
    set is_correct = (
        v_correct_choice is not null
        and choice = v_correct_choice
    )
    where round_id = p_round_id;

    get diagnostics v_count = row_count;

    update public.prediction_rounds
    set
        settlement_price = p_settlement_price,
        settled_at = now(),
        status = 'settled'
    where id = p_round_id;

    return v_count;
end;
$$;


revoke all on function public.submit_prediction(uuid, public.prediction_choice)
from public, anon, authenticated;

grant execute on function public.submit_prediction(uuid, public.prediction_choice)
to authenticated;

revoke all on function public.settle_prediction_round(uuid, numeric)
from public, anon, authenticated;

grant execute on function public.settle_prediction_round(uuid, numeric)
to authenticated;


-- Close expired rounds. Admins can invoke this function.
create or replace function public.close_expired_prediction_rounds()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_count integer;
begin
    if auth.uid() is null or not public.is_admin() then
        raise exception 'Administrator permission required';
    end if;

    update public.prediction_rounds
    set status = 'closed'
    where status = 'open'
      and closes_at <= now();

    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

revoke all on function public.close_expired_prediction_rounds()
from public, anon, authenticated;

grant execute on function public.close_expired_prediction_rounds()
to authenticated;

commit;
