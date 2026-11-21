-- A comment becomes an activity for everyone on the expense, with a preview,
-- and it pushes to everyone but its author.
begin;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}');
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
insert into public.expense_comments (expense_id, author_id, body)
select id, '00000000-0000-0000-0000-00000000000a', repeat('x', 200) from e;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select is(
  (select kind from public.list_activity() limit 1), 'comment_added',
  'the other person sees the comment in their feed'
);
select is(
  (select char_length(note) from public.list_activity() limit 1), 140,
  'with a short preview'
);

reset role;
select is(
  (select count(*)::int from public.activity_recipients r
   join public.activities a on a.id = r.activity_id where a.kind = 'comment_added'),
  2, 'everyone on the expense gets it'
);
select ok(
  public.should_push('comment_added', '00000000-0000-0000-0000-00000000000a', null,
                     '00000000-0000-0000-0000-00000000000b', 0),
  'it pushes to others'
);
select ok(
  not public.should_push('comment_added', '00000000-0000-0000-0000-00000000000a', null,
                         '00000000-0000-0000-0000-00000000000a', 0),
  'but not to its author'
);

select * from finish();
rollback;
