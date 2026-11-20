-- Notification settings: on by default, each kind switched separately, and
-- only by the person themself.
begin;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}');

select ok(public.push_allowed('expense_added', '00000000-0000-0000-0000-00000000000a'),
  'expense pushes are on by default');
select ok(public.push_allowed('reminder', '00000000-0000-0000-0000-00000000000a'),
  'reminder pushes are on by default');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

update public.profiles set notify_expenses = false, notify_reminders = false
where id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select notify_expenses from public.get_my_profile()), false,
  'you can switch a kind off and read it back'
);

-- A can't change B's settings: RLS limits updates to your own row.
update public.profiles set notify_payments = false
where id = '00000000-0000-0000-0000-00000000000b';

reset role;
select ok(not public.push_allowed('expense_updated', '00000000-0000-0000-0000-00000000000a'),
  'expense pushes stop when switched off');
select ok(not public.push_allowed('reminder', '00000000-0000-0000-0000-00000000000a'),
  'reminder pushes stop when switched off');
select ok(public.push_allowed('payment_added', '00000000-0000-0000-0000-00000000000a'),
  'other kinds stay on');
select ok(public.push_allowed('member_added', '00000000-0000-0000-0000-00000000000a'),
  'group pushes stay on');
select ok(public.push_allowed('payment_added', '00000000-0000-0000-0000-00000000000b'),
  'nobody else can switch your pushes off');
select ok(
  not has_function_privilege('authenticated', 'public.push_allowed(text, uuid)', 'execute'),
  'push_allowed is not callable from the app'
);

select * from finish();
rollback;
