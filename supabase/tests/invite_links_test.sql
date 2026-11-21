-- Invite links: making, reusing and opening them, for friends and groups.
begin;
select plan(13);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.co', '{"full_name":"C"}');
insert into public.groups (id, name, created_by) values
  ('00000000-0000-0000-0000-0000000000f1', 'Goa', '00000000-0000-0000-0000-00000000000a');
insert into public.group_members (group_id, user_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

create temp table t (friend text, grp text) on commit drop;
grant all on t to authenticated;
insert into t values (public.create_invite_link(), public.create_invite_link('00000000-0000-0000-0000-0000000000f1'));

select ok((select length(friend) >= 20 from t), 'a link has a long random token');
select is(public.create_invite_link(), (select friend from t), 'the same link is reused');
select isnt((select grp from t), (select friend from t), 'a group link is its own link');
select throws_ok(
  $$select * from public.invite_links$$, '42501', null, 'links can’t be read directly'
);
select throws_ok(
  $$select public.redeem_invite_link((select friend from t))$$,
  'P0001', 'That’s your own invite link', 'you can’t open your own link'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select throws_ok(
  $$select public.create_invite_link('00000000-0000-0000-0000-0000000000f1')$$,
  '42501', null, 'only the admin makes group links'
);
select results_eq(
  $$select friend_id::text, group_id::text, already from public.redeem_invite_link((select friend from t))$$,
  $$values ('00000000-0000-0000-0000-00000000000a', null::text, false)$$,
  'opening a friend link names the friend'
);
select is(
  (select already from public.redeem_invite_link((select friend from t))),
  true, 'opening it again says you’re already friends'
);
select throws_ok(
  $$select public.redeem_invite_link('nope')$$,
  'P0001', 'This invite link has expired or doesn’t exist', 'an unknown token fails'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select is(
  (select group_id::text from public.redeem_invite_link((select grp from t))),
  '00000000-0000-0000-0000-0000000000f1', 'opening a group link names the group'
);

reset role;
select ok(
  exists (select 1 from public.group_members
          where group_id = '00000000-0000-0000-0000-0000000000f1'
            and user_id = '00000000-0000-0000-0000-00000000000c' and left_at is null),
  'and joins it'
);
select ok(
  exists (select 1 from public.friendships
          where user_a = '00000000-0000-0000-0000-00000000000a'
            and user_b = '00000000-0000-0000-0000-00000000000c'),
  'and befriends the admin'
);
select is(
  (select count(*)::int from public.activities
   where kind = 'member_joined' and subject_id = '00000000-0000-0000-0000-00000000000c'),
  1, 'joining is logged once'
);

select * from finish();
rollback;
