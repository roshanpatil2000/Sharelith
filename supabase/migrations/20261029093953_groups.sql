-- Groups. The creator is the admin: only they can add people, remove members
-- or delete the group. Any member can edit the details and leave. Everyone in
-- a group becomes friends with everyone else in it, like Splitwise.
-- Membership changes go through the RPCs below; the app can't insert or
-- delete rows directly.

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text check (char_length(description) <= 500),
  type text not null default 'other' check (type in ('trip', 'home', 'couple', 'other')),
  cover_url text,
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  simplify_debts boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members (user_id);

-- Security definer, so policies can check membership without re-entering
-- group_members' own policy.
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create policy "Members can read their groups"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id));

create policy "Members can edit their groups"
  on public.groups for update
  to authenticated
  using (public.is_group_member(id))
  with check (public.is_group_member(id));

create policy "Members can read their groups' members"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id));

revoke insert, update, delete on public.groups from anon, authenticated;
revoke insert, update, delete on public.group_members from anon, authenticated;
grant update (name, description, type, cover_url, currency, simplify_debts)
  on public.groups to authenticated;

-- Names and photos stay visible inside a group even if two members later
-- stop being friends.
create policy "Group members can read each other's profile"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.group_members mine
      join public.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );

-- Makes every member of the group friends with every other member. These
-- friendships have no created_by, so they don't count toward add-friend's
-- daily limit.
create or replace function public.befriend_group_members(gid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.friendships (user_a, user_b, created_by)
  select a.user_id, b.user_id, null
  from public.group_members a
  join public.group_members b on b.group_id = a.group_id and a.user_id < b.user_id
  where a.group_id = gid
  on conflict do nothing;
$$;

-- Raises unless every id (other than the caller) is the caller's friend.
create or replace function public.assert_all_friends(member_ids uuid[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from unnest(coalesce(member_ids, '{}')) as m (id)
    where m.id <> auth.uid()
      and not exists (
        select 1 from public.friendships f
        where f.user_a = least(auth.uid(), m.id)
          and f.user_b = greatest(auth.uid(), m.id)
      )
  ) then
    raise exception 'You can only add your friends to a group'
      using errcode = 'P0001', hint = 'not_friends';
  end if;
end;
$$;

create or replace function public.assert_group_admin(gid uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.groups g
    where g.id = gid and g.created_by = auth.uid()
  ) then
    raise exception 'Only the group admin can do that'
      using errcode = '42501', hint = 'not_admin';
  end if;
end;
$$;

-- Creates a group with the caller as admin plus the chosen friends.
create or replace function public.create_group(
  name text,
  type text default 'other',
  description text default null,
  member_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  gid uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform public.assert_all_friends(member_ids);

  insert into public.groups (name, type, description, currency, created_by)
  select trim(create_group.name),
         coalesce(create_group.type, 'other'),
         nullif(trim(create_group.description), ''),
         p.default_currency,
         me
  from public.profiles p
  where p.id = me
  returning id into gid;

  insert into public.group_members (group_id, user_id, added_by)
  select gid, m.id, me
  from (select me as id union select unnest(coalesce(member_ids, '{}'))) m
  on conflict do nothing;

  perform public.befriend_group_members(gid);
  return gid;
end;
$$;

-- Admin only: adds friends of the admin to the group.
create or replace function public.add_group_members(gid uuid, member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_group_admin(gid);
  perform public.assert_all_friends(member_ids);

  insert into public.group_members (group_id, user_id, added_by)
  select gid, m.id, auth.uid()
  from unnest(coalesce(member_ids, '{}')) as m (id)
  on conflict do nothing;

  perform public.befriend_group_members(gid);
  update public.groups set updated_at = now() where id = gid;
end;
$$;

-- Admin only. Phase 4 adds: only when the member is settled up.
create or replace function public.remove_group_member(gid uuid, member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_group_admin(gid);
  if member = auth.uid() then
    raise exception 'Leave the group instead of removing yourself'
      using errcode = 'P0001', hint = 'remove_self';
  end if;
  delete from public.group_members where group_id = gid and user_id = member;
end;
$$;

-- Any member. Phase 4 adds: only when settled up.
create or replace function public.leave_group(gid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from public.group_members where group_id = gid and user_id = auth.uid();
end;
$$;

create or replace function public.delete_group(gid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_group_admin(gid);
  delete from public.groups where id = gid;
end;
$$;

-- After someone leaves, is removed or deletes their account: delete the
-- group once it's empty, otherwise make sure it still has an admin (the
-- longest-standing member).
create or replace function public.after_group_member_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.group_members where group_id = old.group_id) then
    delete from public.groups where id = old.group_id;
  else
    update public.groups g
    set created_by = (
      select m.user_id from public.group_members m
      where m.group_id = g.id
      order by m.joined_at, m.user_id
      limit 1
    )
    where g.id = old.group_id
      and (
        g.created_by is null
        or not exists (
          select 1 from public.group_members m
          where m.group_id = g.id and m.user_id = g.created_by
        )
      );
  end if;
  return null;
end;
$$;

create trigger after_group_member_removed
  after delete on public.group_members
  for each row execute function public.after_group_member_removed();

revoke execute on function public.is_group_member(uuid) from public, anon;
revoke execute on function public.befriend_group_members(uuid) from public, anon, authenticated;
revoke execute on function public.assert_all_friends(uuid[]) from public, anon, authenticated;
revoke execute on function public.assert_group_admin(uuid) from public, anon, authenticated;
revoke execute on function public.after_group_member_removed() from public, anon, authenticated;
revoke execute on function public.create_group(text, text, text, uuid[]) from public, anon;
revoke execute on function public.add_group_members(uuid, uuid[]) from public, anon;
revoke execute on function public.remove_group_member(uuid, uuid) from public, anon;
revoke execute on function public.leave_group(uuid) from public, anon;
revoke execute on function public.delete_group(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.create_group(text, text, text, uuid[]) to authenticated;
grant execute on function public.add_group_members(uuid, uuid[]) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;

-- Group covers: public read, members write inside <group_id>/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-covers', 'group-covers', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.can_write_group_cover(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folder text := (storage.foldername(object_name))[1];
begin
  if folder is null or folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_group_member(folder::uuid);
end;
$$;

revoke execute on function public.can_write_group_cover(text) from public, anon;
grant execute on function public.can_write_group_cover(text) to authenticated;

create policy "Members can read their group's cover files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'group-covers' and public.can_write_group_cover(name));

create policy "Members can upload their group's cover"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'group-covers' and public.can_write_group_cover(name));

create policy "Members can replace their group's cover"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'group-covers' and public.can_write_group_cover(name))
  with check (bucket_id = 'group-covers' and public.can_write_group_cover(name));

create policy "Members can delete their group's cover"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'group-covers' and public.can_write_group_cover(name));
