-- Group totals: spending by month and category with your share, and each
-- member's paid and owed; payments left out; members only.
begin;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.co', '{"full_name":"C"}');
insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
create temp table g on commit drop as
select public.create_group('Goa', 'trip', null, array['00000000-0000-0000-0000-00000000000b']::uuid[]) as id;
grant select on g to authenticated;

select public.create_expense(
  'Dinner', 3000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":3000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1000},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":2000}]',
  (select id from g), 'food'
);
select public.create_expense(
  'Taxi', 1000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000b","paid_minor":1000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":500},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":500}]',
  (select id from g), 'transport'
);

select is(
  (select sum(total_minor)::int from public.group_spending((select id from g))),
  4000, 'the group spent both expenses'
);
select is(
  (select sum(my_share_minor)::int from public.group_spending((select id from g))),
  1500, 'with my share'
);
select is(
  (select total_minor::int from public.group_spending((select id from g)) where category = 'food'),
  3000, 'split by category'
);
select results_eq(
  $$select user_id::text, paid_minor::int, share_minor::int
    from public.group_member_spending((select id from g)) order by user_id$$,
  $$values ('00000000-0000-0000-0000-00000000000a', 3000, 1500),
           ('00000000-0000-0000-0000-00000000000b', 1000, 2500)$$,
  'what each member paid and owes'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
select throws_ok(
  $$select * from public.group_spending((select id from g))$$, '42501', null,
  'outsiders can’t see group totals'
);
select throws_ok(
  $$select * from public.group_member_spending((select id from g))$$, '42501', null,
  'or member totals'
);

select * from finish();
rollback;
