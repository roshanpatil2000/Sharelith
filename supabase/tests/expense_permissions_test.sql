-- Only the person who added an expense may change its amounts or delete it.
begin;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.co', '{"full_name":"D"}');
insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
insert into ids values ('group', public.create_group('Trip', 'trip', null,
  array['00000000-0000-0000-0000-00000000000b'::uuid]));

-- A adds it.
insert into ids values ('dinner', public.create_expense(
  'Dinner', 1000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":1000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":500},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":500}]',
  (select id from ids where name = 'group')
));

select is(
  (select created_by::text from public.list_expenses((select id from ids where name = 'group'))),
  '00000000-0000-0000-0000-00000000000a', 'the list says who added it'
);

-- B is in the group but didn't add it.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select throws_ok(
  $$select public.update_expense((select id from ids where name = 'dinner'),
    'Dinner', 2000, 'INR',
    '[{"user_id":"00000000-0000-0000-0000-00000000000b","paid_minor":2000}]',
    '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":2000}]')$$,
  '42501', null, 'others cannot change the amount'
);
select throws_ok(
  $$select public.set_expense_deleted((select id from ids where name = 'dinner'), true)$$,
  '42501', null, 'others cannot delete it'
);
select lives_ok(
  $$select public.rename_expense((select id from ids where name = 'dinner'), '  Team dinner ')$$,
  'others can rename it'
);
select is(
  (select description from public.expenses where id = (select id from ids where name = 'dinner')),
  'Team dinner', 'the new name is saved, trimmed'
);
select is(
  (select amount_minor from public.expenses where id = (select id from ids where name = 'dinner')),
  1000::bigint, 'renaming leaves the amount alone'
);

-- D can't see it at all.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d"}';
select throws_ok(
  $$select public.rename_expense((select id from ids where name = 'dinner'), 'Hacked')$$,
  '42501', null, 'strangers cannot rename it'
);

-- A still can do everything.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select lives_ok(
  $$select public.update_expense((select id from ids where name = 'dinner'),
    'Dinner', 2000, 'INR',
    '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":2000}]',
    '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1000},
      {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":1000}]')$$,
  'the creator can change the amount'
);
select lives_ok(
  $$select public.set_expense_deleted((select id from ids where name = 'dinner'), true)$$,
  'the creator can delete it'
);

select * from finish();
rollback;
