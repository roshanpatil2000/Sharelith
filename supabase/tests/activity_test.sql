-- Who hears about what, and what it did to them.
begin;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"Asha"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"Ben"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.co', '{"full_name":"Cat"}'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.co', '{"full_name":"Dev"}');
insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
insert into ids values ('group', public.create_group('Goa', 'trip', null,
  array['00000000-0000-0000-0000-00000000000b'::uuid]));

select is(
  (select kind || ':' || group_name from public.list_activity() limit 1),
  'group_created:Goa', 'creating a group is recorded with its name'
);

-- A pays 30 for A and B.
insert into ids values ('dinner', public.create_expense(
  'Dinner', 3000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":3000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1500},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":1500}]',
  (select id from ids where name = 'group')
));

select is(
  (select kind || ':' || description || ':' || net_minor || ':' || actor_name
   from public.list_activity() limit 1),
  'expense_added:Dinner:1500:Asha', 'the payer sees they lent 15'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select is(
  (select net_minor from public.list_activity() where kind = 'expense_added'),
  -1500::bigint, 'the other person sees they borrowed 15'
);

-- D is in nothing.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d"}';
select is(
  (select count(*)::integer from public.list_activity()), 0,
  'strangers see none of it'
);
select is(
  (select count(*)::integer from public.activities), 0,
  'and cannot read the table directly'
);

-- A adds C, then moves the dinner onto A and C only.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select public.add_group_members(
  (select id from ids where name = 'group'),
  array['00000000-0000-0000-0000-00000000000c'::uuid]
);
select is(
  (select kind || ':' || subject_name from public.list_activity() limit 1),
  'member_added:Cat', 'adding someone is recorded with their name'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select is(
  (select count(*)::integer from public.list_activity() where kind = 'member_added'),
  1, 'the new member hears they were added'
);
select is(
  (select count(*)::integer from public.list_activity() where kind = 'expense_added'),
  0, 'but not about expenses from before they joined'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select public.update_expense(
  (select id from ids where name = 'dinner'), 'Dinner', 3000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":3000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1500},
    {"user_id":"00000000-0000-0000-0000-00000000000c","owed_minor":1500}]'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select is(
  (select kind || ':' || net_minor from public.list_activity() limit 1),
  'expense_updated:0', 'someone taken off an expense hears it no longer affects them'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select is(
  (select kind || ':' || net_minor from public.list_activity() limit 1),
  'expense_updated:-1500', 'someone put on it sees what they now owe'
);

-- C pays A back.
select public.record_payment(
  '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a',
  1500, 'INR', (select id from ids where name = 'group')
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select is(
  (select kind || ':' || payer_name || '>' || payee_name || ':' || amount_minor
   from public.list_activity() limit 1),
  'payment_added:Cat>Asha:1500', 'a payment says who paid whom'
);

-- A deletes the dinner, then restores it.
select public.set_expense_deleted((select id from ids where name = 'dinner'), true);
select public.set_expense_deleted((select id from ids where name = 'dinner'), false);
select is(
  (select array_agg(kind order by id desc) from (
     select id, kind from public.list_activity() limit 2) recent),
  array['expense_restored', 'expense_deleted'], 'deleting and restoring are both recorded'
);

-- Renames are recorded under the new name.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select public.rename_expense((select id from ids where name = 'dinner'), 'Team dinner');
select is(
  (select kind || ':' || description || ':' || actor_name
   from public.list_activity() limit 1),
  'expense_updated:Team dinner:Cat', 'a rename is recorded with who did it'
);

-- B leaves; everyone, B included, hears it.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select public.leave_group((select id from ids where name = 'group'));
select is(
  (select kind || ':' || subject_name from public.list_activity() limit 1),
  'member_left:Ben', 'leaving is recorded for the person who left'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select is(
  (select kind from public.list_activity() limit 1),
  'member_left', 'and for the rest of the group'
);

-- Paging: older than a given id.
select is(
  (select count(*)::integer from public.list_activity(
     (select min(id) from (select id from public.list_activity() limit 2) newest), 100)),
  (select count(*)::integer - 2 from public.list_activity(null, 100)),
  'paging skips what you already have'
);
select is(
  (select count(*)::integer from public.list_activity(null, 1)), 1,
  'and returns no more than asked'
);

select * from finish();
rollback;
