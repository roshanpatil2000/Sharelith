-- Receipts: Pro people on the expense attach and upload; others on it can see;
-- outsiders can't do either.
begin;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.co', '{"full_name":"C"}');
update public.profiles set pro_override = true where id = '00000000-0000-0000-0000-00000000000a';
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

select ok(
  public.can_write_receipt((select id from e)::text || '/r.jpg'),
  'a Pro member of the expense can upload its receipt'
);
select lives_ok(
  format($$select public.set_expense_receipt(%L, %L)$$, (select id from e), (select id from e)::text || '/r.jpg'),
  'and attach it'
);
select is(
  (select receipt_path from public.expenses where id = (select id from e)),
  (select id from e)::text || '/r.jpg', 'the expense keeps the path'
);
select throws_ok(
  format($$select public.set_expense_receipt(%L, %L)$$, (select id from e), '11111111-1111-1111-1111-111111111111/r.jpg'),
  '22023', null, 'a photo from another expense is refused'
);

-- B is on the expense but free: can see, can't add.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select ok(public.can_read_receipt((select id from e)::text || '/r.jpg'), 'others on the expense can see it');
select ok(not public.can_write_receipt((select id from e)::text || '/r.jpg'), 'but not upload without Pro');
select throws_ok(
  format($$select public.set_expense_receipt(%L, null)$$, (select id from e)),
  '42501', null, 'or change it'
);

-- C isn't on the expense at all.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select ok(not public.can_read_receipt((select id from e)::text || '/r.jpg'), 'outsiders cannot see it');
select ok(not public.can_read_receipt('not-a-uuid/r.jpg'), 'odd paths are refused');

select * from finish();
rollback;
