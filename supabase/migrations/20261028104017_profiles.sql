-- Profiles: one row per auth user, created on sign-up.

create table public.profiles (
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

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Phase 2 widens reads to friends and group members.
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Only these columns are user-editable; email and verification are not.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url, default_currency, timezone)
  on public.profiles to authenticated;

-- Create the profile from sign-up metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  currency text := upper(coalesce(meta ->> 'default_currency', ''));
begin
  insert into public.profiles (id, full_name, email, phone, default_currency, timezone)
  values (
    new.id,
    coalesce(nullif(trim(meta ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(trim(meta ->> 'phone'), ''),
    case when currency ~ '^[A-Z]{3}$' then currency else 'INR' end,
    coalesce(nullif(meta ->> 'timezone', ''), 'Asia/Kolkata')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Marks the caller's email verified. Requires that the current session was
-- issued by an email one-time code (JWT amr contains method "otp"), so a
-- client can't mark itself verified without receiving the email.
create or replace function public.mark_email_verified()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as m
    where m ->> 'method' = 'otp'
  ) then
    raise exception 'Email must be verified with a one-time code'
      using errcode = 'P0001';
  end if;

  update public.profiles
  set email_verified_at = coalesce(email_verified_at, now())
  where id = auth.uid();
end;
$$;

-- Deletes the caller's account; the profile goes with it via cascade.
-- The client removes the user's avatar through the Storage API first.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.mark_email_verified() from public, anon;
revoke execute on function public.delete_account() from public, anon;
grant execute on function public.mark_email_verified() to authenticated;
grant execute on function public.delete_account() to authenticated;

-- Avatars: public read, each user writes only inside their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users can read their own avatar files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can replace their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
