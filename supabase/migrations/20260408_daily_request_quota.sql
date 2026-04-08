create or replace function public.request_day_window_start(
  p_timezone text default 'Asia/Shanghai'
)
returns timestamptz
language sql
stable
as $$
  select timezone('utc', date_trunc('day', timezone(p_timezone, now())));
$$;

create or replace function public.count_requests_today(
  p_profile_id uuid default null,
  p_anonymous_session_id uuid default null,
  p_timezone text default 'Asia/Shanghai'
)
returns integer
language plpgsql
stable
as $$
declare
  window_start timestamptz := public.request_day_window_start(p_timezone);
  window_end timestamptz := window_start + interval '1 day';
  used_count integer := 0;
begin
  if (p_profile_id is null and p_anonymous_session_id is null)
    or (p_profile_id is not null and p_anonymous_session_id is not null) then
    raise exception 'count_requests_today requires exactly one actor id';
  end if;

  if p_profile_id is not null then
    select count(*) into used_count
    from public.request_logs
    where profile_id = p_profile_id
      and requested_at >= window_start
      and requested_at < window_end;
  else
    select count(*) into used_count
    from public.request_logs
    where anonymous_session_id = p_anonymous_session_id
      and requested_at >= window_start
      and requested_at < window_end;
  end if;

  return coalesce(used_count, 0);
end;
$$;

create or replace function public.record_profile_request_usage(
  p_profile_id uuid,
  p_source_text text default null,
  p_source_url text default null,
  p_metadata jsonb default null,
  p_daily_limit integer default 5,
  p_timezone text default 'Asia/Shanghai'
)
returns table(
  used_today integer,
  daily_limit integer,
  daily_remaining integer,
  credits_balance integer,
  consumed_credit boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  window_start timestamptz := public.request_day_window_start(p_timezone);
  window_end timestamptz := window_start + interval '1 day';
  used_count integer := 0;
  current_credits integer := 0;
  spent_credit boolean := false;
begin
  select p.credits_balance
    into current_credits
  from public.profiles p
  where p.id = p_profile_id
  for update;

  if not found then
    raise exception 'profile not found';
  end if;

  select count(*) into used_count
  from public.request_logs
  where profile_id = p_profile_id
    and requested_at >= window_start
    and requested_at < window_end;

  if used_count >= p_daily_limit then
    if current_credits <= 0 then
      raise exception 'QUOTA_EXCEEDED';
    end if;

    update public.profiles
    set credits_balance = credits_balance - 1
    where id = p_profile_id
    returning profiles.credits_balance into current_credits;

    spent_credit := true;
  end if;

  insert into public.request_logs (
    profile_id,
    source_text,
    source_url,
    metadata
  ) values (
    p_profile_id,
    p_source_text,
    p_source_url,
    p_metadata
  );

  used_count := used_count + 1;

  return query
  select
    used_count,
    p_daily_limit,
    greatest(p_daily_limit - used_count, 0),
    current_credits,
    spent_credit;
end;
$$;

create or replace function public.record_anonymous_request_usage(
  p_anonymous_session_id uuid,
  p_source_text text default null,
  p_source_url text default null,
  p_metadata jsonb default null,
  p_daily_limit integer default 2,
  p_timezone text default 'Asia/Shanghai'
)
returns table(
  used_today integer,
  daily_limit integer,
  daily_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  window_start timestamptz := public.request_day_window_start(p_timezone);
  window_end timestamptz := window_start + interval '1 day';
  used_count integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext(p_anonymous_session_id::text));

  select count(*) into used_count
  from public.request_logs
  where anonymous_session_id = p_anonymous_session_id
    and requested_at >= window_start
    and requested_at < window_end;

  if used_count >= p_daily_limit then
    raise exception 'QUOTA_EXCEEDED';
  end if;

  insert into public.request_logs (
    anonymous_session_id,
    source_text,
    source_url,
    metadata
  ) values (
    p_anonymous_session_id,
    p_source_text,
    p_source_url,
    p_metadata
  );

  used_count := used_count + 1;

  return query
  select
    used_count,
    p_daily_limit,
    greatest(p_daily_limit - used_count, 0);
end;
$$;
