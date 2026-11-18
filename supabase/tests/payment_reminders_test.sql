-- Payment reminders: only to friends who owe you, once a day, and they push.
begin;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.co', '{"full_name":"C"}');
insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

select throws_ok(
  $$select public.send_reminder('00000000-0000-0000-0000-00000000000b')$$,
  'P0001', null, 'not when they owe you nothing'
);
select throws_ok(
  $$select public.send_reminder('00000000-0000-0000-0000-00000000000c')$$,
  '42501', null, 'only friends'
);

-- A pays 20, split with B: B owes A 10.
select public.create_expense(
  'Lunch', 2000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":2000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1000},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":1000}]'
);

select lives_ok(
  $$select public.send_reminder('00000000-0000-0000-0000-00000000000b')$$,
  'you can remind a friend who owes you'
);
select throws_ok(
  $$select public.send_reminder('00000000-0000-0000-0000-00000000000b')$$,
  'P0001', null, 'but only once a day'
);

-- B can't remind A: B is the one who owes.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select throws_ok(
  $$select public.send_reminder('00000000-0000-0000-0000-00000000000a')$$,
  'P0001', null, 'not someone you owe'
);
select is(
  (select amount_minor::int from public.list_activity() where kind = 'reminder'),
  1000, 'the reminder shows in their feed with what they owe'
);

reset role;
select ok(
  public.should_push('reminder', 'a0000000-0000-0000-0000-000000000000',
    'b0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 0),
  'the reminded friend gets a push'
);
select ok(
  not public.should_push('reminder', 'a0000000-0000-0000-0000-000000000000',
    'b0000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 0),
  'the sender does not'
);

select * from finish();
rollback;
