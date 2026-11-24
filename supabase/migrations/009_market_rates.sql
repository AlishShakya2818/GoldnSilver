
begin;

-- Insert or update a Nepal local rate.
create or replace function public.save_local_rate(
    p_metal public.metal_type,
    p_rate numeric,
    p_currency text,
    p_unit text,
    p_rate_date date,
    p_source text,
    p_publish boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id uuid;
begin
    if auth.uid() is null or not public.is_admin() then
        raise exception 'Administrator permission required';
    end if;

    if p_rate <= 0 then
        raise exception 'Rate must be greater than zero';
    end if;

    if trim(coalesce(p_currency, '')) = ''
       or trim(coalesce(p_unit, '')) = '' then
        raise exception 'Currency and unit are required';
    end if;

    insert into public.local_rate_updates (
        metal,
        rate,
        currency,
        unit,
        rate_date,
        source,
        is_published,
        entered_by
    )
    values (
        p_metal,
        p_rate,
        upper(p_currency),
        p_unit,
        p_rate_date,
        p_source,
        p_publish,
        auth.uid()
    )
    on conflict (metal, rate_date, unit, currency)
    do update set
        rate = excluded.rate,
        source = excluded.source,
        is_published = excluded.is_published,
        entered_by = excluded.entered_by
    returning id into v_id;

    return v_id;
end;
$$;


-- Store the latest international market price from a trusted provider.
create or replace function public.save_market_price(
    p_metal public.metal_type,
    p_provider text,
    p_symbol text,
    p_currency text,
    p_price numeric,
    p_observed_at timestamptz,
    p_raw_payload jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id uuid;
begin
    if auth.uid() is null or not public.is_admin() then
        raise exception 'Administrator permission required';
    end if;

    if p_price <= 0 then
        raise exception 'Market price must be greater than zero';
    end if;

    insert into public.market_price_cache (
        metal,
        provider,
        provider_symbol,
        quote_currency,
        price_per_troy_ounce,
        observed_at,
        fetched_at,
        is_stale,
        raw_payload
    )
    values (
        p_metal,
        p_provider,
        p_symbol,
        upper(p_currency),
        p_price,
        p_observed_at,
        now(),
        false,
        p_raw_payload
    )
    returning id into v_id;

    return v_id;
end;
$$;


revoke all on function public.save_local_rate(
    public.metal_type, numeric, text, text, date, text, boolean
) from public, anon, authenticated;

revoke all on function public.save_market_price(
    public.metal_type, text, text, text, numeric, timestamptz, jsonb
) from public, anon, authenticated;

grant execute on function public.save_local_rate(
    public.metal_type, numeric, text, text, date, text, boolean
) to authenticated;

grant execute on function public.save_market_price(
    public.metal_type, text, text, text, numeric, timestamptz, jsonb
) to authenticated;

commit;
