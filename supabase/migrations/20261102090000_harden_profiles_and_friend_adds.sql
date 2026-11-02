-- Exact email lookups, profile privacy and a sturdier add-friend limit.

-- add-friend matches emails exactly, so they must all be stored lowercase.
-- Fails loudly if two accounts differ only by case; merge those by hand.
update public.profiles set email = lower(email) where email <> lower(email);

create unique index profiles_email_key on public.profiles (email);

-- Friends and group members see only these columns; RLS decides which rows.
-- Phone, time zone and the rest stay private: get_my_profile() returns them
-- to their owner.
revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, email, avatar_url, joined_at)
  on public.profiles to authenticated;

create or replace function public.get_my_profile()
returns setof public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.profiles where id = auth.uid();
$$;

revoke execute on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- One row per add-friend lookup. Unlike friendships, these survive a remove,
-- so remove-and-re-add can't reset the limit, and lookups that add nobody
-- still count.
create table public.friend_add_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index friend_add_attempts_user_idx
  on public.friend_add_attempts (user_id, created_at);

alter table public.friend_add_attempts enable row level security;
revoke all on public.friend_add_attempts from anon, authenticated;

-- Records an attempt if the user is under the 24-hour limit. The lock makes
-- count-then-insert safe against parallel requests from the same user.
create or replace function public.claim_friend_add_attempt(uid uuid, daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  delete from public.friend_add_attempts
  where user_id = uid and created_at < now() - interval '24 hours';

  select count(*) into used
  from public.friend_add_attempts
  where user_id = uid;

  if used >= daily_limit then
    return false;
  end if;

  insert into public.friend_add_attempts (user_id) values (uid);
  return true;
end;
$$;

revoke execute on function public.claim_friend_add_attempt(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_friend_add_attempt(uuid, integer)
  to service_role;
