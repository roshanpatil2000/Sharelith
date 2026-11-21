-- Recently deleted lists only what you deleted, and restoring brings it back.
begin;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}');
insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
create temp table e on commit drop as
select public.create_expense(
  'Lunch', 2000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":2000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1000},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":1000}]'
) as id;
grant select on e to authenticated;
select public.set_expense_deleted((select id from e), true);

select is(
  (select description from public.list_deleted_expenses()), 'Lunch',
  'what you deleted is listed'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select is(
  (select count(*)::int from public.list_deleted_expenses()), 0,
  'not for others on it (they can’t restore it)'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select public.set_expense_deleted((select id from e), false);
select is(
  (select count(*)::int from public.list_deleted_expenses()), 0,
  'restoring takes it off the list'
);
select is(
  (select count(*)::int from public.list_expenses() where id = (select id from e)), 1,
  'and back in your expenses'
);

select * from finish();
rollback;
