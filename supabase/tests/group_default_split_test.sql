-- A group's default split: members set it, values are checked, null clears.
begin;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.co', '{"full_name":"C"}');
insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
create temp table g on commit drop as
select public.create_group('Flat', 'home', null, array['00000000-0000-0000-0000-00000000000b']::uuid[]) as id;
grant select on g to authenticated;

select lives_ok(
  format($$select public.set_group_default_split(%L,
    '{"type":"percent","values":{"00000000-0000-0000-0000-00000000000a":60,"00000000-0000-0000-0000-00000000000b":40}}')$$,
    (select id from g)),
  'a member sets 60/40'
);
select is(
  (select default_split ->> 'type' from public.groups where id = (select id from g)),
  'percent', 'and it is saved'
);
select throws_ok(
  format($$select public.set_group_default_split(%L,
    '{"type":"percent","values":{"00000000-0000-0000-0000-00000000000a":60}}')$$, (select id from g)),
  '22023', 'Percentages must add up to 100', 'percentages must make 100'
);
select throws_ok(
  format($$select public.set_group_default_split(%L,
    '{"type":"shares","values":{"00000000-0000-0000-0000-00000000000c":1}}')$$, (select id from g)),
  '22023', 'Everyone in the split must be in the group', 'only members'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select throws_ok(
  format($$select public.set_group_default_split(%L, null)$$, (select id from g)),
  '42501', null, 'outsiders can’t change it'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select public.set_group_default_split((select id from g), null);
select is(
  (select default_split from public.groups where id = (select id from g)), null,
  'null goes back to equal'
);

select * from finish();
rollback;
