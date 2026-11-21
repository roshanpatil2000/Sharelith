-- Invite links and QR codes. Anyone can make a link that befriends whoever
-- opens it; a group's admin can make one that also adds them to the group.
-- Links last 30 days and can be used by many people.

create table public.invite_links (
  token text primary key,
  created_by uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create index invite_links_created_by_idx on public.invite_links (created_by);

-- Only the functions below touch links.
alter table public.invite_links enable row level security;
revoke all on public.invite_links from anon, authenticated;

alter table public.activities drop constraint activities_kind_check;
alter table public.activities add constraint activities_kind_check check (kind in (
  'expense_added', 'expense_updated', 'expense_deleted', 'expense_restored',
  'payment_added', 'payment_deleted', 'payment_restored',
  'group_created', 'member_added', 'member_left', 'member_removed',
  'reminder', 'member_joined'
));

-- Makes (or reuses) an invite link: for you, or for a group you run.
-- Returns its token; the app builds the URL.
create or replace function public.create_invite_link(gid uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  existing text;
  made text;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if gid is not null then
    perform public.assert_group_admin(gid);
  end if;
  -- One live link per person (and group) is enough; reuse it.
  select l.token into existing
  from public.invite_links l
  where l.created_by = me
    and l.group_id is not distinct from gid
    and l.expires_at > now() + interval '1 day'
  order by l.created_at desc
  limit 1;
  if existing is not null then
    return existing;
  end if;
  made := translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
  insert into public.invite_links (token, created_by, group_id) values (made, me, gid);
  return made;
end;
$$;

-- Opens an invite link: you become friends with whoever made it, and join
-- their group if it's a group link. Returns where to go next.
create or replace function public.redeem_invite_link(token text)
returns table (friend_id uuid, group_id uuid, already boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  link public.invite_links;
  was_friend boolean;
  was_member boolean := false;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into link from public.invite_links l
  where l.token = redeem_invite_link.token and l.expires_at > now();
  if link.token is null then
    raise exception 'This invite link has expired or doesn’t exist'
      using errcode = 'P0001', hint = 'invite_expired';
  end if;
  if link.created_by = me then
    raise exception 'That’s your own invite link'
      using errcode = 'P0001', hint = 'own_invite';
  end if;

  was_friend := exists (
    select 1 from public.friendships f
    where (f.user_a, f.user_b) = (least(me, link.created_by), greatest(me, link.created_by))
  );
  insert into public.friendships (user_a, user_b, created_by)
  values (least(me, link.created_by), greatest(me, link.created_by), link.created_by)
  on conflict do nothing;

  if link.group_id is not null then
    if not exists (select 1 from public.groups g where g.id = link.group_id and g.archived_at is null) then
      raise exception 'This group no longer exists'
        using errcode = 'P0001', hint = 'group_gone';
    end if;
    was_member := exists (
      select 1 from public.group_members m
      where m.group_id = link.group_id and m.user_id = me and m.left_at is null
    );
    if not was_member then
      insert into public.group_members as gm (group_id, user_id, added_by)
      values (link.group_id, me, link.created_by)
      on conflict (group_id, user_id) do update
        set left_at = null, joined_at = now(), added_by = link.created_by
        where gm.left_at is not null;
      perform public.befriend_group_members(link.group_id, array[me]);
      update public.groups set updated_at = now() where id = link.group_id;
      perform public.log_activity(
        'member_joined', public.active_member_ids(link.group_id), link.group_id, null, me
      );
    end if;
  end if;

  return query select link.created_by, link.group_id, (was_friend and (link.group_id is null or was_member));
end;
$$;

revoke execute on function public.create_invite_link(uuid) from public, anon;
revoke execute on function public.redeem_invite_link(text) from public, anon;
grant execute on function public.create_invite_link(uuid) to authenticated;
grant execute on function public.redeem_invite_link(text) to authenticated;
