-- Expenses: validation, access, balances and what happens when people leave.
begin;
select plan(24);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.co', '{"full_name":"C"}'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.co', '{"full_name":"D"}');

insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

insert into ids values ('group', public.create_group('Trip', 'trip', null, array[
  '00000000-0000-0000-0000-00000000000b'::uuid,
  '00000000-0000-0000-0000-00000000000c'::uuid
]));

-- A paid 900, split equally between A, B and C.
insert into ids values ('dinner', public.create_expense(
  'Dinner', 900, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":900}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":300},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":300},
    {"user_id":"00000000-0000-0000-0000-00000000000c","owed_minor":300}]',
  (select id from ids where name = 'group')
));

select is(
  (select sum(net_minor)::bigint from public.list_my_balances()),
  600::bigint, 'the payer is owed everyone else''s share'
);
select is(
  (select count(*)::int from public.list_expenses((select id from ids where name = 'group'))),
  1, 'the expense shows in the group'
);
select is(
  (select my_net_minor from public.list_expenses((select id from ids where name = 'group'))),
  600::bigint, 'the list shows what the payer lent'
);

select throws_ok(
  $$select public.create_expense('Bad', 900, 'INR',
    '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":800}]',
    '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":900}]')$$,
  'P0001', null, 'payers must add up to the total'
);
select throws_ok(
  $$select public.create_expense('Bad', 900, 'INR',
    '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":900}]',
    '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":899}]')$$,
  'P0001', null, 'shares must add up to the total'
);
select throws_ok(
  $$select public.create_expense('Bad', 900, 'INR',
    '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":900}]',
    '[{"user_id":"00000000-0000-0000-0000-00000000000d","owed_minor":900}]')$$,
  'P0001', null, 'non-group expenses are only with friends'
);
select throws_ok(
  $$select public.create_expense('Bad', 100, 'INR',
    '[{"user_id":"00000000-0000-0000-0000-00000000000b","paid_minor":100}]',
    '[{"user_id":"00000000-0000-0000-0000-00000000000c","owed_minor":100}]')$$,
  'P0001', null, 'you must be part of a non-group expense'
);
select throws_ok(
  $$select public.create_expense('Bad', 100, 'INR',
    '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":100}]',
    '[{"user_id":"00000000-0000-0000-0000-00000000000d","owed_minor":100}]',
    (select id from ids where name = 'group'))$$,
  'P0001', null, 'group expenses are only with members'
);
select throws_ok(
  $$insert into public.expenses (description, amount_minor, currency, created_by)
    values ('Direct', 100, 'INR', '00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'the app cannot write expenses directly'
);

-- Multiple payers: A and B paid, C owes both.
insert into ids values ('taxi', public.create_expense(
  'Taxi', 300, 'USD',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":200},
    {"user_id":"00000000-0000-0000-0000-00000000000b","paid_minor":100}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000c","owed_minor":300}]',
  (select id from ids where name = 'group')
));
select is(
  (select count(*)::int from public.expense_debts
   where expense_id = (select id from ids where name = 'taxi')),
  2, 'one debtor can owe two payers'
);
select is(
  (select net_minor from public.list_my_balances()
   where currency = 'USD'),
  200::bigint, 'currencies stay separate'
);

select public.update_expense(
  (select id from ids where name = 'taxi'), 'Taxi', 400, 'USD',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":400}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000c","owed_minor":400}]'
);
select is(
  (select net_minor from public.list_my_balances() where currency = 'USD'),
  400::bigint, 'editing recomputes the balance'
);

select public.set_expense_deleted((select id from ids where name = 'taxi'), true);
select is(
  (select count(*)::int from public.list_my_balances() where currency = 'USD'),
  0, 'a deleted expense leaves balances'
);
select public.set_expense_deleted((select id from ids where name = 'taxi'), false);
select is(
  (select count(*)::int from public.list_my_balances() where currency = 'USD'),
  1, 'restoring brings it back'
);
select public.set_expense_deleted((select id from ids where name = 'taxi'), true);

-- D is a stranger.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d"}';
select is(
  (select count(*)::int from public.expenses), 0, 'strangers cannot see expenses'
);
select is(
  (select count(*)::int from public.list_expenses()), 0, 'or list them'
);
select throws_ok(
  $$select public.set_expense_deleted((select id from ids where name = 'dinner'), true)$$,
  '42501', null, 'or delete them'
);

-- B owes A, so can't leave or be removed.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select throws_ok(
  $$select public.leave_group((select id from ids where name = 'group'))$$,
  'P0001', null, 'you must settle up to leave'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select throws_ok(
  $$select public.remove_group_member(
    (select id from ids where name = 'group'),
    '00000000-0000-0000-0000-00000000000b')$$,
  'P0001', null, 'members must settle up to be removed'
);
select throws_ok(
  $$select public.remove_friend('00000000-0000-0000-0000-00000000000b')$$,
  'P0001', null, 'friends must settle up to be removed'
);
select throws_ok(
  $$select public.delete_group((select id from ids where name = 'group'))$$,
  'P0001', null, 'groups must be settled to be deleted'
);

-- B deletes their account: A's balance survives against an anonymous profile.
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
select is(
  (select full_name from public.profiles
   where id = '00000000-0000-0000-0000-00000000000b'),
  'Deleted user', 'a deleted account leaves an anonymous profile'
);
select is(
  (select phone is null and email is null from public.profiles
   where id = '00000000-0000-0000-0000-00000000000b'),
  true, 'with no personal details'
);

select public.close_group((select id from ids where name = 'group'));
select is(
  public.is_orphan_group_cover((select id from ids where name = 'group')::text || '/cover.jpg'),
  true, 'an archived group''s cover counts as an orphan'
);

select * from finish();
rollback;
