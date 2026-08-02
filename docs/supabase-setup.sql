-- ============================================================
-- MEASURE APP - PAYWALL DATABASE SETUP
-- Paste this whole file into the Supabase SQL Editor and Run.
-- Safe to run more than once (idempotent).
-- ============================================================

-- 1. Profiles table (created if missing, extended if it exists)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  plan text not null default 'free',
  export_count_today integer not null default 0,
  export_count_date date,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists export_count_today integer not null default 0;
alter table public.profiles add column if not exists export_count_date date;
alter table public.profiles add column if not exists bg_count_today integer not null default 0;
alter table public.profiles add column if not exists bg_count_date date;
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;

-- 2. Auto-create a profile whenever a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Backfill profiles for any existing users that lack one
insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
on conflict (id) do nothing;

-- 4. Row Level Security: users can READ their own profile only.
--    No client-side insert/update - all writes go through the
--    signup trigger, the RPCs below, or the server (service role).
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Remove any older permissive write policies if they exist.
-- (If you created policies with different names, drop those too:
--  check Supabase Dashboard -> Authentication -> Policies.)
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

-- 5. Daily limit functions (SECURITY DEFINER so they can write
--    even though clients cannot). Free plan: 1 export/day and
--    1 background removal/day. Pro: unlimited.

create or replace function public.consume_export()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  free_limit constant integer := 1;
  used integer;
begin
  select * into p from public.profiles where id = auth.uid() for update;

  if not found then
    return json_build_object('allowed', false, 'plan', null, 'remaining', 0, 'limit', free_limit);
  end if;

  if p.plan = 'pro' then
    return json_build_object('allowed', true, 'plan', 'pro', 'remaining', null, 'limit', null);
  end if;

  used := case when p.export_count_date is distinct from current_date then 0 else p.export_count_today end;

  if used >= free_limit then
    return json_build_object('allowed', false, 'plan', 'free', 'remaining', 0, 'limit', free_limit);
  end if;

  update public.profiles
  set export_count_today = used + 1,
      export_count_date = current_date
  where id = p.id;

  return json_build_object('allowed', true, 'plan', 'free', 'remaining', free_limit - used - 1, 'limit', free_limit);
end;
$$;

create or replace function public.get_export_status()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  free_limit constant integer := 1;
  used integer;
begin
  select * into p from public.profiles where id = auth.uid();

  if not found then
    return json_build_object('plan', null, 'remaining', 0, 'limit', free_limit);
  end if;

  if p.plan = 'pro' then
    return json_build_object('plan', 'pro', 'remaining', null, 'limit', null);
  end if;

  used := case when p.export_count_date is distinct from current_date then 0 else p.export_count_today end;

  return json_build_object('plan', 'free', 'remaining', greatest(free_limit - used, 0), 'limit', free_limit);
end;
$$;

create or replace function public.consume_bg_removal()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  free_limit constant integer := 1;
  used integer;
begin
  select * into p from public.profiles where id = auth.uid() for update;

  if not found then
    return json_build_object('allowed', false, 'plan', null, 'remaining', 0, 'limit', free_limit);
  end if;

  if p.plan = 'pro' then
    return json_build_object('allowed', true, 'plan', 'pro', 'remaining', null, 'limit', null);
  end if;

  used := case when p.bg_count_date is distinct from current_date then 0 else p.bg_count_today end;

  if used >= free_limit then
    return json_build_object('allowed', false, 'plan', 'free', 'remaining', 0, 'limit', free_limit);
  end if;

  update public.profiles
  set bg_count_today = used + 1,
      bg_count_date = current_date
  where id = p.id;

  return json_build_object('allowed', true, 'plan', 'free', 'remaining', free_limit - used - 1, 'limit', free_limit);
end;
$$;

-- 6. Only logged-in users (and the server) may call these
revoke execute on function public.consume_export() from public, anon;
revoke execute on function public.get_export_status() from public, anon;
revoke execute on function public.consume_bg_removal() from public, anon;
grant execute on function public.consume_export() to authenticated, service_role;
grant execute on function public.get_export_status() to authenticated, service_role;
grant execute on function public.consume_bg_removal() to authenticated, service_role;

-- ============================================================
-- SHOPIFY BILLING: per-shop subscription + monthly generation limit.
-- Shopify requests aren't Supabase-authenticated users, so this table
-- is only ever touched server-side via the service role key.
-- Free plan for Shopify: none (must subscribe). Paid plan: 150
-- generations/month ($12.95/mo, matches Gemini cost breakeven).
-- ============================================================

create table if not exists public.shopify_shops (
  shop text primary key,
  access_token text,
  plan text not null default 'none', -- none | trialing | active | cancelled
  shopify_charge_id text,
  trial_ends_at timestamptz,
  generation_count integer not null default 0,
  generation_period_start date,
  created_at timestamptz not null default now()
);

alter table public.shopify_shops enable row level security;
-- No policies: RLS with zero policies blocks all client access while
-- service_role (used by the server) bypasses it entirely.

drop function if exists public.shopify_consume_generation(text, integer);

create or replace function public.shopify_consume_generation(p_shop text, p_limit integer default 150, p_trial_limit integer default 15)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.shopify_shops%rowtype;
  used integer;
  period date;
  effective_limit integer;
begin
  select * into s from public.shopify_shops where shop = p_shop for update;

  if not found or s.plan not in ('trialing', 'active') then
    return json_build_object('allowed', false, 'plan', coalesce(s.plan, 'none'), 'remaining', 0, 'limit', p_limit);
  end if;

  effective_limit := case when s.plan = 'trialing' then p_trial_limit else p_limit end;

  period := date_trunc('month', current_date)::date;
  used := case when s.generation_period_start is distinct from period then 0 else s.generation_count end;

  if used >= effective_limit then
    return json_build_object('allowed', false, 'plan', s.plan, 'remaining', 0, 'limit', effective_limit);
  end if;

  update public.shopify_shops
  set generation_count = used + 1,
      generation_period_start = period
  where shop = p_shop;

  return json_build_object('allowed', true, 'plan', s.plan, 'remaining', effective_limit - used - 1, 'limit', effective_limit);
end;
$$;

drop function if exists public.shopify_get_billing_status(text, integer);

create or replace function public.shopify_get_billing_status(p_shop text, p_limit integer default 150, p_trial_limit integer default 15)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.shopify_shops%rowtype;
  used integer;
  period date;
  effective_limit integer;
begin
  select * into s from public.shopify_shops where shop = p_shop;

  if not found then
    return json_build_object('plan', 'none', 'remaining', 0, 'limit', p_limit, 'trial_ends_at', null);
  end if;

  effective_limit := case when s.plan = 'trialing' then p_trial_limit else p_limit end;

  period := date_trunc('month', current_date)::date;
  used := case when s.generation_period_start is distinct from period then 0 else s.generation_count end;

  return json_build_object(
    'plan', s.plan,
    'remaining', greatest(effective_limit - used, 0),
    'limit', effective_limit,
    'trial_ends_at', s.trial_ends_at
  );
end;
$$;

revoke execute on function public.shopify_consume_generation(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.shopify_get_billing_status(text, integer, integer) from public, anon, authenticated;
grant execute on function public.shopify_consume_generation(text, integer, integer) to service_role;
grant execute on function public.shopify_get_billing_status(text, integer, integer) to service_role;
