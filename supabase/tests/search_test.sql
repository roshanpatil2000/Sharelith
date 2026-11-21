-- Search finds your expenses by description, notes, group and comments,
-- never someone else's, and treats % and _ literally.
begin;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.co', '{"full_name":"C"}');
insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
create temp table e as
select public.create_expense(
  'Goa dinner', 2000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":2000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1000},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":1000}]'
) as id;
reset role;
update public.expenses set notes = 'Paid 100% by card' where id = (select id from e);
set local role authenticated;
insert into public.expense_comments (expense_id, author_id, body)
select id, '00000000-0000-0000-0000-00000000000a', 'Remember the tip' from e;

select is((select count(*)::int from public.search_expenses('DINNER')), 1, 'matches the description, any case');
select is((select count(*)::int from public.search_expenses('by card')), 1, 'matches notes');
select is((select count(*)::int from public.search_expenses('tip')), 1, 'matches comments');
select is((select count(*)::int from public.search_expenses('100%')), 1, '% matches literally');
select is((select count(*)::int from public.search_expenses('10_')), 0, '_ is not a wildcard');
select is((select count(*)::int from public.search_expenses('d')), 0, 'one letter finds nothing');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select is((select count(*)::int from public.search_expenses('dinner')), 0, 'others’ expenses stay hidden');

select * from finish();
rollback;
