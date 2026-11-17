-- Group activity reaches every current member; non-group activity doesn't.
begin;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"Asha"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"Ben"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.co', '{"full_name":"Cat"}'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.co', '{"full_name":"Dev"}');
insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000d');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
insert into ids values ('group', public.create_group('Goa', 'trip', null,
  array['00000000-0000-0000-0000-00000000000b'::uuid,
        '00000000-0000-0000-0000-00000000000c'::uuid,
        '00000000-0000-0000-0000-00000000000d'::uuid]));

-- A pays 20 for A and B only. C and D are in the group but not on it.
select public.create_expense(
  'Taxi', 2000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":2000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1000},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":1000}]',
  (select id from ids where name = 'group')
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select is(
  (select kind || ':' || description || ':' || net_minor
   from public.list_activity() where kind = 'expense_added'),
  'expense_added:Taxi:0', 'a member not on the expense still hears about it, as not involved'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select is(
  (select net_minor from public.list_activity() where kind = 'expense_added'),
  -1000::bigint, 'someone on it still sees what they owe'
);

-- B pays A back; C hears about that too.
select public.record_payment('00000000-0000-0000-0000-00000000000b',
  '00000000-0000-0000-0000-00000000000a', 1000, 'INR',
  (select id from ids where name = 'group'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select is(
  (select payer_name || '>' || payee_name || ':' || net_minor
   from public.list_activity() where kind = 'payment_added'),
  'Ben>Asha:0', 'group payments reach every member'
);

-- D leaves; later group activity no longer reaches D.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d"}';
select public.leave_group((select id from ids where name = 'group'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select public.create_expense(
  'Dinner', 3000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":3000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1500},
    {"user_id":"00000000-0000-0000-0000-00000000000c","owed_minor":1500}]',
  (select id from ids where name = 'group')
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d"}';
select is(
  (select count(*)::integer from public.list_activity() where description = 'Dinner'),
  0, 'people who left the group stop hearing about it'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select is(
  (select net_minor from public.list_activity() where description = 'Dinner'),
  0::bigint, 'current members not on it hear about it'
);

-- Outside groups, only the people on the expense hear about it.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select public.create_expense(
  'Coffee', 400, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":400}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":200},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":200}]'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select is(
  (select count(*)::integer from public.list_activity() where description = 'Coffee'),
  0, 'non-group expenses stay between the people on them'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select is(
  (select net_minor from public.list_activity() where description = 'Coffee'),
  -200::bigint, 'and reach those people as before'
);

select * from finish();
rollback;
