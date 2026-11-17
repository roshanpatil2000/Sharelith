-- The test-user flag: off by default, and only an admin can change it.
begin;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}');
insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

select is(
  (select is_test_user from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  false, 'new accounts are not test users'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

select throws_ok(
  $$update public.profiles set is_test_user = true
    where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'users cannot mark themselves'
);
select throws_ok(
  $$select is_test_user from public.profiles
    where id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'or read the flag on a friend''s profile'
);
select is(
  (select is_test_user from public.get_my_profile()),
  false, 'but can see their own'
);

reset role;
update public.profiles set is_test_user = true
where id = '00000000-0000-0000-0000-00000000000a';
select ok(
  (select is_test_user from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'an admin can mark an account'
);

select * from finish();
rollback;
