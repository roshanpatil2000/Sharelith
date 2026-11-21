-- Comments: people on the expense read and add them; authors delete their
-- own; outsiders see nothing.
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
create temp table e as
select public.create_expense(
  'Dinner', 2000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":2000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1000},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":1000}]'
) as id;
grant select on e to authenticated;

select lives_ok(
  format($$insert into public.expense_comments (expense_id, author_id, body)
           values (%L, '00000000-0000-0000-0000-00000000000a', 'Paid by card')$$, (select id from e)),
  'someone on the expense can comment'
);
select throws_ok(
  format($$insert into public.expense_comments (expense_id, author_id, body)
           values (%L, '00000000-0000-0000-0000-00000000000b', 'Fake')$$, (select id from e)),
  '42501', null, 'but not as someone else'
);
select throws_ok(
  format($$insert into public.expense_comments (expense_id, author_id, body)
           values (%L, '00000000-0000-0000-0000-00000000000a', '   ')$$, (select id from e)),
  '23514', null, 'and not an empty comment'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select is(
  (select count(*)::int from public.expense_comments),
  1, 'others on the expense read it'
);
delete from public.expense_comments;
reset role;
select is(
  (select count(*)::int from public.expense_comments),
  1, 'they can’t delete someone else’s comment'
);
set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select is(
  (select count(*)::int from public.expense_comments),
  0, 'outsiders see no comments'
);
select throws_ok(
  format($$insert into public.expense_comments (expense_id, author_id, body)
           values (%L, '00000000-0000-0000-0000-00000000000c', 'Hi')$$, (select id from e)),
  '42501', null, 'or add one'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
delete from public.expense_comments;
reset role;
select is(
  (select count(*)::int from public.expense_comments),
  0, 'authors delete their own'
);

select * from finish();
rollback;
