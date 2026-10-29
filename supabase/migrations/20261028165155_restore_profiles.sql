-- Recreates public.profiles after it was dropped from the dashboard, and
-- backfills a row for every existing auth user. Idempotent: safe to run on
-- a database where the table still exists.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 100),
  email text,
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{6,20}$'),
  avatar_url text,
  default_currency char(3) not null default 'INR'
    check (default_currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Kolkata',
  -- Set only by mark_email_verified(); sign-up auto-confirms in auth.
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists sync_display_name on public.profiles;
create trigger sync_display_name
  after update of full_name on public.profiles
  for each row
  when (old.full_name is distinct from new.full_name)
  execute function public.sync_display_name();

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- A new table gets Supabase's default grants; narrow them again.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url, default_currency, timezone)
  on public.profiles to authenticated;

-- One row per existing user, rebuilt from sign-up metadata. Values that fail
-- the table's checks fall back to defaults instead of aborting the restore.
insert into public.profiles (id, full_name, email, phone, default_currency, timezone, created_at)
select
  u.id,
  left(
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      split_part(u.email, '@', 1)
    ),
    100
  ),
  u.email,
  case
    when trim(u.raw_user_meta_data ->> 'phone') ~ '^\+?[0-9 ]{6,20}$'
      then trim(u.raw_user_meta_data ->> 'phone')
  end,
  case
    when upper(u.raw_user_meta_data ->> 'default_currency') ~ '^[A-Z]{3}$'
      then upper(u.raw_user_meta_data ->> 'default_currency')
    else 'INR'
  end,
  coalesce(nullif(u.raw_user_meta_data ->> 'timezone', ''), 'Asia/Kolkata'),
  u.created_at
from auth.users u
on conflict (id) do nothing;
