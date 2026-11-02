-- Group friendships, admin succession and orphaned covers.
begin;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.co', '{"full_name":"C"}'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.co', '{"full_name":"D"}');

-- D was invited and hasn't joined.
update public.profiles set joined_at = null
where id = '00000000-0000-0000-0000-00000000000d';

insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000d');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

create temp table g on commit drop as
  select public.create_group('Trip', 'trip', null, array[
    '00000000-0000-0000-0000-00000000000b'::uuid,
    '00000000-0000-0000-0000-00000000000d'::uuid
  ]) as id;
grant select on g to authenticated;

select is(
  (select count(*)::int from public.group_members m
   where m.group_id = (select id from g)),
  3, 'the group has its creator and both friends'
);

reset role;
select is(
  (select count(*)::int from public.friendships
   where user_a = '00000000-0000-0000-0000-00000000000b'
     and user_b = '00000000-0000-0000-0000-00000000000d'),
  1, 'creating a group makes its members friends'
);

-- B removes D, then the admin adds C.
delete from public.friendships
where user_a = '00000000-0000-0000-0000-00000000000b'
  and user_b = '00000000-0000-0000-0000-00000000000d';

set local role authenticated;
select public.add_group_members(
  (select id from g),
  array['00000000-0000-0000-0000-00000000000c'::uuid]
);
reset role;

select is(
  (select count(*)::int from public.friendships
   where user_a = '00000000-0000-0000-0000-00000000000b'
     and user_b = '00000000-0000-0000-0000-00000000000d'),
  0, 'adding someone does not restore a removed friendship'
);
select is(
  (select count(*)::int from public.friendships
   where user_a = '00000000-0000-0000-0000-00000000000b'
     and user_b = '00000000-0000-0000-0000-00000000000c'),
  1, 'the new member becomes friends with the group'
);

-- D joined the group before C, but hasn't accepted their invite.
update public.group_members set joined_at = now() + interval '1 hour'
where user_id = '00000000-0000-0000-0000-00000000000c';
update public.group_members set joined_at = now() + interval '1 minute'
where user_id = '00000000-0000-0000-0000-00000000000d';
update public.group_members set joined_at = now() + interval '2 hours'
where user_id = '00000000-0000-0000-0000-00000000000b';

set local role authenticated;
select public.leave_group((select id from g));
reset role;

select is(
  (select gr.created_by::text from public.groups gr where gr.id = (select id from g)),
  '00000000-0000-0000-0000-00000000000c',
  'admin skips a member who has not joined'
);

select is(
  public.is_orphan_group_cover((select id from g)::text || '/cover.jpg'),
  false, 'a live group''s cover is not an orphan'
);
select is(
  public.is_orphan_group_cover(
    '11111111-1111-1111-1111-111111111111/cover.jpg'
  ),
  true, 'a cover with no group is an orphan'
);
select is(
  public.is_orphan_group_cover('not-a-uuid/cover.jpg'),
  false, 'other paths are not orphans'
);

-- Everyone leaves: the empty group is deleted.
delete from public.group_members where group_id = (select id from g);
select is(
  (select count(*)::int from public.groups gr where gr.id = (select id from g)),
  0, 'an empty group is deleted'
);

select * from finish();
rollback;
