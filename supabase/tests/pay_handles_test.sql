-- A UPI ID is readable by friends and group members, not by strangers,
-- and never through the profiles table.
begin;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.co', '{"full_name":"C"}');
insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
update public.profiles set upi_id = 'asha@okaxis', paypal_username = 'asha'
where id = '00000000-0000-0000-0000-00000000000a';

select throws_ok(
  $$update public.profiles set upi_id = 'not a upi'
    where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'a malformed UPI ID is refused'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select is(
  (select upi_id from public.get_pay_handles('00000000-0000-0000-0000-00000000000a')),
  'asha@okaxis', 'a friend reads the UPI ID'
);
select throws_ok(
  $$select upi_id from public.profiles where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'but not from the profiles table'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select is(
  (select count(*)::int from public.get_pay_handles('00000000-0000-0000-0000-00000000000a')),
  0, 'a stranger gets nothing'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select is(
  (select paypal_username from public.get_pay_handles('00000000-0000-0000-0000-00000000000a')),
  'asha', 'you read your own'
);

select * from finish();
rollback;
