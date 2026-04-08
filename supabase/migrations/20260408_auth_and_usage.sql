create extension if not exists pgcrypto with schema extensions;

create or replace function public.generate_api_token()
returns text
language sql
volatile
as $$
  select 'hd_' || encode(extensions.gen_random_bytes(24), 'hex');
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  api_token text not null unique default public.generate_api_token(),
  credits_balance integer not null default 0 check (credits_balance >= 0),
  billing_status text not null default 'inactive',
  stripe_customer_id text unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.request_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  anonymous_session_id uuid,
  source_text text,
  source_url text,
  metadata jsonb,
  requested_at timestamptz not null default timezone('utc', now()),
  constraint request_logs_actor_check check (
    profile_id is not null or anonymous_session_id is not null
  )
);

create index if not exists request_logs_profile_requested_at_idx
  on public.request_logs (profile_id, requested_at desc)
  where profile_id is not null;

create index if not exists request_logs_anonymous_requested_at_idx
  on public.request_logs (anonymous_session_id, requested_at desc)
  where anonymous_session_id is not null;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.request_logs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "request_logs_select_own" on public.request_logs;
create policy "request_logs_select_own"
on public.request_logs
for select
to authenticated
using (auth.uid() = profile_id);

drop policy if exists "request_logs_insert_own" on public.request_logs;
create policy "request_logs_insert_own"
on public.request_logs
for insert
to authenticated
with check (auth.uid() = profile_id);
