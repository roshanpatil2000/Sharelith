-- Insights: Pro only; your share and what you paid, per month and category;
-- payments and other people's expenses left out.
begin;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.co', '{"full_name":"C"}');
insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select throws_ok($$select * from public.spending_insights(12)$$, '42501', null, 'free users get no insights');

reset role;
update public.profiles set pro_override = true where id = '00000000-0000-0000-0000-00000000000a';
set local role authenticated;

-- A pays 3000 for food, split with B: A's share 1500, paid 3000.
select public.create_expense('Dinner', 3000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":3000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1500},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":1500}]',
  null, 'food');
-- B pays 1000 for transport, split with A: A's share 500, paid 0.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select public.create_expense('Taxi', 1000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000b","paid_minor":1000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":500},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":500}]',
  null, 'transport');
-- B and C only: not A's.
select public.create_expense('Movie', 800, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000b","paid_minor":800}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000c","owed_minor":800}]');
-- A payment from B to A: not spending.
select public.record_payment('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 500, 'INR');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select is((select count(*)::int from public.spending_insights(12)), 2, 'only A''s two expenses, no payment');
select is((select share_minor::int from public.spending_insights(12) where category = 'food'), 1500, 'your share of food');
select is((select paid_minor::int from public.spending_insights(12) where category = 'food'), 3000, 'what you paid for food');
select is((select share_minor::int from public.spending_insights(12) where category = 'transport'), 500, 'your share when someone else paid');
select is((select month from public.spending_insights(12) limit 1), date_trunc('month', current_date)::date, 'grouped by month');
select throws_ok($$select * from public.spending_insights(0)$$, '22023', null, 'months must be 1 to 24');

select * from finish();
rollback;
