-- Recording payments, and what they do to balances.
begin;
select plan(17);

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
insert into ids values ('group', public.create_group('Trip', 'trip', null,
  array['00000000-0000-0000-0000-00000000000b'::uuid, '00000000-0000-0000-0000-00000000000c'::uuid]));

-- A pays 30, split three ways: B and C each owe A 10.
select public.create_expense(
  'Dinner', 3000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":3000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1000},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":1000},
    {"user_id":"00000000-0000-0000-0000-00000000000c","owed_minor":1000}]',
  (select id from ids where name = 'group')
);

-- C can't record a payment between B and A.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select throws_ok(
  $$select public.record_payment('00000000-0000-0000-0000-00000000000b',
    '00000000-0000-0000-0000-00000000000a', 1000, 'INR',
    (select id from ids where name = 'group'))$$,
  '42501', null, 'only the payer or payee can record a payment'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select throws_ok(
  $$select public.record_payment('00000000-0000-0000-0000-00000000000b',
    '00000000-0000-0000-0000-00000000000b', 1000, 'INR')$$,
  'P0001', null, 'nobody pays themselves'
);
select throws_ok(
  $$select public.leave_group((select id from ids where name = 'group'))$$,
  'P0001', null, 'B cannot leave while owing'
);

insert into ids values ('payment', public.record_payment(
  '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a',
  1000, 'INR', (select id from ids where name = 'group')
));

select is(
  (select count(*)::integer from public.list_my_balances()),
  0, 'paying A settles B up'
);
select ok(
  (select is_payment from public.list_expenses((select id from ids where name = 'group'))
   where id = (select id from ids where name = 'payment')),
  'the list marks it as a payment'
);
select is(
  (select paid_by::text || '>' || paid_to::text
   from public.list_expenses((select id from ids where name = 'group'))
   where id = (select id from ids where name = 'payment')),
  '00000000-0000-0000-0000-00000000000b>00000000-0000-0000-0000-00000000000a',
  'the list says who paid whom'
);
select is(
  (select created_by::text from public.expenses where id = (select id from ids where name = 'payment')),
  '00000000-0000-0000-0000-00000000000b', 'whoever records it owns it'
);

select throws_ok(
  $$select public.update_expense((select id from ids where name = 'payment'),
    'Dinner', 1000, 'INR',
    '[{"user_id":"00000000-0000-0000-0000-00000000000b","paid_minor":1000}]',
    '[{"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":1000}]')$$,
  'P0001', null, 'a payment cannot be edited into an expense'
);
select throws_ok(
  $$select public.rename_expense((select id from ids where name = 'payment'), 'Gift')$$,
  'P0001', null, 'a payment cannot be renamed'
);

-- Deleting it brings the debt back; restoring settles it again.
select public.set_expense_deleted((select id from ids where name = 'payment'), true);
select is(
  (select net_minor from public.list_my_balances()),
  -1000::bigint, 'deleting the payment brings the debt back'
);
select public.set_expense_deleted((select id from ids where name = 'payment'), false);

-- A sees every member's net in the group.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select is(
  (select array_agg(user_id::text || ':' || net_minor order by user_id)
   from public.list_group_balances((select id from ids where name = 'group'))),
  array['00000000-0000-0000-0000-00000000000a:1000', '00000000-0000-0000-0000-00000000000c:-1000'],
  'group balances show who is still owed and who still owes'
);

-- C pays A part of it: the rest stays owed.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select public.record_payment('00000000-0000-0000-0000-00000000000c',
  '00000000-0000-0000-0000-00000000000a', 400, 'INR',
  (select id from ids where name = 'group'));
select is(
  (select net_minor from public.list_my_balances()),
  -600::bigint, 'a part payment leaves the rest owed'
);

-- A strangers' view, and payments outside groups.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d"}';
select throws_ok(
  $$select * from public.list_group_balances((select id from ids where name = 'group'))$$,
  '42501', null, 'non-members cannot see group balances'
);
select throws_ok(
  $$select public.record_payment('00000000-0000-0000-0000-00000000000d',
    '00000000-0000-0000-0000-00000000000a', 100, 'INR')$$,
  'P0001', null, 'payments outside a group need a friendship'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select lives_ok(
  $$select public.record_payment('00000000-0000-0000-0000-00000000000a',
    '00000000-0000-0000-0000-00000000000b', 500, 'INR')$$,
  'friends can settle outside a group'
);
select is(
  (select net_minor from public.list_my_balances()
   where friend_id = '00000000-0000-0000-0000-00000000000b' and group_id is null),
  500::bigint, 'paying a friend outside a group means they owe you that back'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select lives_ok(
  $$select public.leave_group((select id from ids where name = 'group'))$$,
  'B can leave once settled up in the group'
);

select * from finish();
rollback;
