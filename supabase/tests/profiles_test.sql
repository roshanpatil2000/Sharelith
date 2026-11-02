-- Profile privacy and the add-friend limit. Run with: npx supabase test db
begin;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A","phone":"+911111111111"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B","phone":"+912222222222"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.co', '{"full_name":"C"}');

insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$update public.profiles set email = 'a@test.co'
    where id = '00000000-0000-0000-0000-00000000000b'$$,
  '23505', null, 'emails are unique'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

select is(
  (select full_name from public.profiles
   where id = '00000000-0000-0000-0000-00000000000b'),
  'B', 'friends can read names'
);
select throws_ok(
  $$select phone from public.profiles
    where id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'friends cannot read phone numbers'
);
select throws_ok(
  'select * from public.profiles', '42501', null, 'select * is not allowed'
);
select is(
  (select count(*)::int from public.profiles
   where id = '00000000-0000-0000-0000-00000000000c'),
  0, 'strangers are hidden'
);
select is(
  (select phone from public.get_my_profile()),
  '+911111111111', 'get_my_profile returns your own private columns'
);
select is(
  (select count(*)::int from public.get_my_profile()),
  1, 'get_my_profile returns only you'
);
select throws_ok(
  'select * from public.friend_add_attempts',
  '42501', null, 'users cannot read attempts'
);
select throws_ok(
  $$select public.claim_friend_add_attempt(
    '00000000-0000-0000-0000-00000000000a', 1000)$$,
  '42501', null, 'users cannot claim attempts themselves'
);

reset role;

select is(
  public.claim_friend_add_attempt('00000000-0000-0000-0000-00000000000a', 1),
  true, 'the first attempt is allowed'
);
delete from public.friendships
where user_a = '00000000-0000-0000-0000-00000000000a';
select is(
  public.claim_friend_add_attempt('00000000-0000-0000-0000-00000000000a', 1),
  false, 'the limit holds after removing a friend'
);

select * from finish();
rollback;
