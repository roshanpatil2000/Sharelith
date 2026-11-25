-- Editing an expense keeps a revision; people outside it can't read it.
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
create temp table e on commit drop as
select public.create_expense(
  'Dinner', 2000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":2000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1000},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":1000}]'
) as id;
grant select on e to authenticated;

select public.update_expense(
  (select id from e), 'Dinner out', 3000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":3000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1500},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":1500}]'
);
-- Saving without changes adds nothing.
select public.update_expense(
  (select id from e), 'Dinner out', 3000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":3000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1500},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":1500}]'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select is(
  (select count(*)::int from public.list_expense_revisions((select id from e))), 1,
  'one revision for one real change'
);
select is(
  (select (before->>'amount_minor')::int || '>' || (after->>'amount_minor')
   from public.list_expense_revisions((select id from e))), '2000>3000',
  'the revision keeps the old and new amount'
);
select is(
  (select editor_name || '/' || (names->>'00000000-0000-0000-0000-00000000000b')
   from public.list_expense_revisions((select id from e))), 'A/B',
  'editor and participant names come back'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select is(
  (select count(*)::int from public.list_expense_revisions((select id from e))), 0,
  'an outsider gets nothing from the RPC'
);
select is(
  (select count(*)::int from public.expense_revisions), 0,
  'an outsider can''t read the table'
);

select * from finish();
rollback;
