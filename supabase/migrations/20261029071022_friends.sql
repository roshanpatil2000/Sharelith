-- Friends: one row per pair (user_a < user_b). Adding is instant, like
-- Splitwise. Writes go through the add-friend Edge Function (service role)
-- and remove_friend(); the app can only read its own friendships.

create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create index friendships_user_b_idx on public.friendships (user_b);
create index friendships_created_by_idx on public.friendships (created_by, created_at);

alter table public.friendships enable row level security;

create policy "Users can read their own friendships"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (user_a, user_b));

revoke insert, update, delete on public.friendships from anon, authenticated;

-- Invited (placeholder) users: invited_by set, joined_at null until they
-- accept the invite (which confirms their email).
alter table public.profiles
  add column invited_by uuid references public.profiles (id) on delete set null,
  add column joined_at timestamptz;

update public.profiles set joined_at = created_at where joined_at is null;

-- Friends can see each other's profile (name, email, avatar).
create policy "Friends can read each other's profile"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.friendships f
      where (f.user_a = (select auth.uid()) and f.user_b = profiles.id)
         or (f.user_b = (select auth.uid()) and f.user_a = profiles.id)
    )
  );

-- Sign-up creates the profile. invited_by is trusted only for users created
-- by an admin invite (auth.users.invited_at), never from client metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  currency text := upper(coalesce(meta ->> 'default_currency', ''));
  inviter uuid := case
    when new.invited_at is not null
      and (meta ->> 'invited_by') ~ '^[0-9a-f-]{36}$'
    then (meta ->> 'invited_by')::uuid
  end;
begin
  insert into public.profiles (
    id, full_name, email, phone, default_currency, timezone, invited_by, joined_at
  )
  values (
    new.id,
    left(coalesce(nullif(trim(meta ->> 'full_name'), ''), split_part(new.email, '@', 1)), 100),
    new.email,
    case when trim(meta ->> 'phone') ~ '^\+?[0-9 ]{6,20}$' then trim(meta ->> 'phone') end,
    case when currency ~ '^[A-Z]{3}$' then currency else 'INR' end,
    coalesce(nullif(meta ->> 'timezone', ''), 'Asia/Kolkata'),
    inviter,
    case when new.invited_at is null then now() end
  );
  return new;
end;
$$;

-- Accepting an invite confirms the email: the person has now joined.
create or replace function public.sync_email_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email_verified_at = coalesce(email_verified_at, new.email_confirmed_at),
      joined_at = coalesce(joined_at, new.email_confirmed_at)
  where id = new.id;
  return new;
end;
$$;

-- The caller's friends, newest first.
create or replace function public.list_friends()
returns table (
  id uuid,
  full_name text,
  email text,
  avatar_url text,
  invited boolean,
  friends_since timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.email, p.avatar_url,
         (p.joined_at is null) as invited,
         f.created_at as friends_since
  from public.friendships f
  join public.profiles p
    on p.id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
  where auth.uid() in (f.user_a, f.user_b)
  order by f.created_at desc;
$$;

-- Removes a friendship. Phase 4 adds: only when the balance is settled.
create or replace function public.remove_friend(friend uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from public.friendships
  where user_a = least(auth.uid(), friend)
    and user_b = greatest(auth.uid(), friend);
end;
$$;

revoke execute on function public.list_friends() from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
