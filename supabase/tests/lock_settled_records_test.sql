-- Records that can no longer be settled stay as they are.
begin;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.co', '{"full_name":"C"}'),
  ('00000000-0000-0000-0000-00000000000e', 'e@test.co', '{"full_name":"E"}');
insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000e');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
insert into ids values ('group', public.create_group('Trip', 'trip', null,
  array['00000000-0000-0000-0000-00000000000b'::uuid, '00000000-0000-0000-0000-00000000000c'::uuid]));

-- A pays 10 for A and B; C pays 6 for A and C.
insert into ids values ('dinner', public.create_expense(
  'Dinner', 1000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":1000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":500},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":500}]',
  (select id from ids where name = 'group')
));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
insert into ids values ('taxi', public.create_expense(
  'Taxi', 600, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000c","paid_minor":600}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":300},
    {"user_id":"00000000-0000-0000-0000-00000000000c","owed_minor":300}]',
  (select id from ids where name = 'group')
));

-- B pays A back and leaves.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select public.record_payment('00000000-0000-0000-0000-00000000000b',
  '00000000-0000-0000-0000-00000000000a', 500, 'INR',
  (select id from ids where name = 'group'));
select public.leave_group((select id from ids where name = 'group'));

-- Someone on Dinner has left: A can't move that balance any more.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select throws_ok(
  $$select public.set_expense_deleted((select id from ids where name = 'dinner'), true)$$,
  'P0001', null, 'an expense with someone who left cannot be deleted'
);
select throws_ok(
  $$select public.update_expense((select id from ids where name = 'dinner'),
    'Dinner', 2000, 'INR',
    '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":2000}]',
    '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":2000}]')$$,
  'P0001', null, 'or have its amounts changed'
);
select lives_ok(
  $$select public.rename_expense((select id from ids where name = 'dinner'), 'Big dinner')$$,
  'but members can still rename it'
);
select throws_ok(
  $$select public.set_expense_deleted(
     (select id from public.expenses where is_payment and group_id = (select id from ids where name = 'group')), true)$$,
  '42501', null, 'B''s payment is still B''s alone to delete'
);

-- Taxi only involves people still here, so it can still change.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select lives_ok(
  $$select public.set_expense_deleted((select id from ids where name = 'taxi'), true)$$,
  'expenses among people still in the group can be deleted'
);
select lives_ok(
  $$select public.set_expense_deleted((select id from ids where name = 'taxi'), false)$$,
  'and restored'
);

-- B, gone, can't touch the group's records either.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select throws_ok(
  $$select public.set_expense_deleted(
     (select id from public.expenses where is_payment and group_id = (select id from ids where name = 'group')), true)$$,
  'P0001', null, 'someone who left cannot delete their payment'
);
select throws_ok(
  $$select public.rename_expense((select id from ids where name = 'dinner'), 'Mine now')$$,
  'P0001', null, 'or rename the group''s expenses'
);
select is(
  (select count(*)::integer from public.list_my_balances()), 0,
  'and stays settled'
);

-- Outside groups: once a friendship ends, its expenses are fixed.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
insert into ids values ('lunch', public.create_expense(
  'Lunch', 800, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":800}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000c","owed_minor":800}]'
));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select public.record_payment('00000000-0000-0000-0000-00000000000c',
  '00000000-0000-0000-0000-00000000000a', 800, 'INR');
-- C clears Taxi so A and C are square everywhere, then A removes C.
select public.set_expense_deleted((select id from ids where name = 'taxi'), true);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select public.remove_friend('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$select public.set_expense_deleted((select id from ids where name = 'lunch'), true)$$,
  'P0001', null, 'an expense with a former friend cannot be deleted'
);

-- Deleting an account needs every balance settled first.
insert into ids values ('tickets', public.create_expense(
  'Tickets', 300, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":300}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000e","owed_minor":300}]'
));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e"}';
select throws_ok(
  $$select public.delete_account()$$,
  'P0001', null, 'you cannot delete your account while you owe money'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select throws_ok(
  $$select public.delete_account()$$,
  'P0001', null, 'or while you are owed money'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e"}';
select public.record_payment('00000000-0000-0000-0000-00000000000e',
  '00000000-0000-0000-0000-00000000000a', 300, 'INR');
select lives_ok(
  $$select public.delete_account()$$,
  'once settled, the account can be deleted'
);

-- And nobody can reopen what was settled with them.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select throws_ok(
  $$select public.set_expense_deleted((select id from ids where name = 'tickets'), true)$$,
  'P0001', null, 'expenses with a deleted account cannot be changed'
);

select * from finish();
rollback;
