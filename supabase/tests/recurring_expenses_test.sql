-- Recurring expenses: set up by the creator, copied when due (catching up),
-- month ends kept, and stopped when a copy can't be added.
begin;
select plan(10);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}');
insert into public.friendships (user_a, user_b) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

select is(public.repeat_date('2026-01-31', 'monthly', 1), '2026-02-28'::date, 'February ends on the 28th');
select is(public.repeat_date('2026-01-31', 'monthly', 2), '2026-03-31'::date, 'and March goes back to the 31st');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
create temp table e on commit drop as
select public.create_expense(
  'Rent', 2000, 'INR',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","paid_minor":2000}]',
  '[{"user_id":"00000000-0000-0000-0000-00000000000a","owed_minor":1000},
    {"user_id":"00000000-0000-0000-0000-00000000000b","owed_minor":1000}]',
  null, 'home', (current_date - interval '15 days')::date
) as id;
grant select on e to authenticated;

select is(
  public.set_expense_repeat((select id from e), 'weekly'),
  (current_date - interval '8 days')::date,
  'repeating weekly starts a week after the expense'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select throws_ok(
  format($$select public.set_expense_repeat(%L, 'monthly')$$, (select id from e)),
  '42501', null, 'only the creator can change it'
);
select is((select frequency from public.recurring_expenses), 'weekly', 'others on it can see it repeats');
select throws_ok(
  'select public.run_recurring_expenses()', '42501', null, 'people can’t run the job'
);

reset role;
select is(public.run_recurring_expenses(), 2, 'catches up on both missed weeks');
select is(
  (select count(*)::int from public.expenses where description = 'Rent' and deleted_at is null),
  3, 'two copies were added'
);
select is(
  (select next_date from public.recurring_expenses),
  (current_date + interval '6 days')::date, 'and the next one is next week'
);

-- Deleting the latest copy stops it at the next run.
update public.expenses set deleted_at = now()
where id = (select last_expense_id from public.recurring_expenses);
update public.recurring_expenses set next_date = current_date;
select public.run_recurring_expenses();
select is((select count(*)::int from public.recurring_expenses), 0, 'a deleted template stops the repeat');

select * from finish();
rollback;
