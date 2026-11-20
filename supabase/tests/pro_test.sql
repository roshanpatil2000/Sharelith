-- Pro: subscriptions and the override decide it; only the server can grant it.
begin;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}');

select ok(not public.is_pro('00000000-0000-0000-0000-00000000000a'), 'nobody is Pro by default');

insert into public.subscriptions (user_id, product_id, purchase_token, status, expires_at) values
  ('00000000-0000-0000-0000-00000000000a', 'pro_monthly', 'tok-a', 'active', now() + interval '20 days');
select ok(public.is_pro('00000000-0000-0000-0000-00000000000a'), 'an active subscription gives Pro');

update public.subscriptions set status = 'canceled' where user_id = '00000000-0000-0000-0000-00000000000a';
select ok(public.is_pro('00000000-0000-0000-0000-00000000000a'), 'a cancelled one lasts until the period ends');

update public.subscriptions set status = 'grace' where user_id = '00000000-0000-0000-0000-00000000000a';
select ok(public.is_pro('00000000-0000-0000-0000-00000000000a'), 'grace period keeps Pro');

update public.subscriptions set status = 'on_hold' where user_id = '00000000-0000-0000-0000-00000000000a';
select ok(not public.is_pro('00000000-0000-0000-0000-00000000000a'), 'on hold (payment failed) does not');

update public.subscriptions set status = 'active', expires_at = now() - interval '1 minute'
where user_id = '00000000-0000-0000-0000-00000000000a';
select ok(not public.is_pro('00000000-0000-0000-0000-00000000000a'), 'an expired period does not');

update public.profiles set pro_override = true where id = '00000000-0000-0000-0000-00000000000b';
select ok(public.is_pro('00000000-0000-0000-0000-00000000000b'), 'the override gives Pro');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

select is((select is_pro from public.my_pro_status()), false, 'you can read your own status');
select is((select count(*)::int from public.subscriptions), 1, 'and only your own subscription');
select throws_ok(
  $$update public.profiles set pro_override = true where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'you cannot give yourself Pro'
);
select throws_ok($$select public.require_pro()$$, '42501', null, 'Pro-only actions refuse free users');

reset role;
select ok(
  has_function_privilege('service_role', 'public.is_pro(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.is_pro(uuid)', 'execute'),
  'the server can check anyone''s Pro; the app cannot'
);

select * from finish();
rollback;
