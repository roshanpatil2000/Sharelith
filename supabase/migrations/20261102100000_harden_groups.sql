-- Group fixes: friendships only for new members, sensible admin succession,
-- and cleaning up covers of deleted groups.

-- Pairs only the given members with the rest of the group. Re-pairing everyone
-- would bring back friendships two existing members had removed.
drop function public.befriend_group_members(uuid);

create function public.befriend_group_members(gid uuid, new_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.friendships (user_a, user_b, created_by)
  select least(m.user_id, n.id), greatest(m.user_id, n.id), null
  from public.group_members m
  cross join unnest(new_ids) as n (id)
  where m.group_id = gid and m.user_id <> n.id
  on conflict do nothing;
$$;

revoke execute on function public.befriend_group_members(uuid, uuid[])
  from public, anon, authenticated;

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

  perform public.befriend_group_members(gid, coalesce(member_ids, '{}'));
  return gid;
end;
$$;

create or replace function public.add_group_members(gid uuid, member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  added uuid[];
begin
  perform public.assert_group_admin(gid);
  perform public.assert_all_friends(member_ids);

  with inserted as (
    insert into public.group_members (group_id, user_id, added_by)
    select gid, m.id, auth.uid()
    from unnest(coalesce(member_ids, '{}')) as m (id)
    on conflict do nothing
    returning user_id
  )
  select coalesce(array_agg(user_id), '{}') into added from inserted;

  perform public.befriend_group_members(gid, added);
  update public.groups set updated_at = now() where id = gid;
end;
$$;

-- Admin passes to the longest-standing member who has actually joined;
-- someone who hasn't accepted their invite can't act as admin.
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
      select m.user_id
      from public.group_members m
      join public.profiles p on p.id = m.user_id
      where m.group_id = g.id
      order by p.joined_at is null, m.joined_at, m.user_id
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

-- Once a group is gone nobody is a member, so nobody could remove its cover.
-- Anyone signed in may clear these leftovers: they belong to no group.
create or replace function public.is_orphan_group_cover(object_name text)
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
  return not exists (select 1 from public.groups where id = folder::uuid);
end;
$$;

revoke execute on function public.is_orphan_group_cover(text) from public, anon;
grant execute on function public.is_orphan_group_cover(text) to authenticated;

create policy "Anyone can read an orphaned group cover"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'group-covers' and public.is_orphan_group_cover(name));

create policy "Anyone can delete an orphaned group cover"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'group-covers' and public.is_orphan_group_cover(name));
