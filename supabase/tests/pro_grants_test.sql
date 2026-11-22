-- Granted Pro: give, replace, expire and revoke it; admins only.
begin;
select plan(27);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}');

create function pg_temp.source_of_a() returns text language sql as $$
  select source from public.admin_pro_status
  where user_id = '00000000-0000-0000-0000-00000000000a';
$$;

select is(pg_temp.source_of_a(), 'free', 'free by default');
select lives_ok($$select public.grant_pro(' A@Test.co ', 'test', 'QA phone')$$, 'grant by email, any case');
select is(pg_temp.source_of_a(), 'grant', 'the view says it was granted');
select ok(public.is_pro('00000000-0000-0000-0000-00000000000a'), 'is_pro follows it');
select ok(not public.is_pro('00000000-0000-0000-0000-00000000000b'), 'nobody else gets it');

select lives_ok(
  $$select public.grant_pro('a@test.co', 'complimentary', null, now() + interval '30 days')$$,
  'granting again replaces it'
);
select is(
  (select revoke_note from public.pro_grants where revoked_at is not null),
  'replaced', 'the old grant stays as history'
);
select is(
  (select grant_reason from public.admin_pro_status where user_id = '00000000-0000-0000-0000-00000000000a'),
  'complimentary', 'the view shows the current one'
);

select throws_ok($$select public.grant_pro('no@test.co', 'test')$$, 'P0001', null, 'unknown email');
select throws_ok($$select public.grant_pro('a@test.co', 'friend')$$, '23514', null, 'unknown reason');
select throws_ok(
  $$select public.grant_pro('a@test.co', 'test', null, now() - interval '1 day')$$,
  'P0001', null, 'past end date'
);
select ok(public.is_pro('00000000-0000-0000-0000-00000000000a'), 'a failed grant leaves the old one on');

insert into public.subscriptions (user_id, product_id, purchase_token, status, expires_at) values
  ('00000000-0000-0000-0000-00000000000a', 'pro_monthly', 'tok-a', 'active', now() + interval '20 days');
select is(pg_temp.source_of_a(), 'subscription+grant', 'both sources');

update public.pro_grants
set granted_at = now() - interval '2 days', expires_at = now() - interval '1 day'
where revoked_at is null;
select is(pg_temp.source_of_a(), 'subscription', 'an expired grant no longer counts');

update public.subscriptions set expires_at = now() - interval '1 minute';
select is(pg_temp.source_of_a(), 'free', 'both expired is free');

select lives_ok($$select public.grant_pro('a@test.co', 'support')$$, 'an expired grant can be replaced');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select results_eq(
  $$select is_pro, product_id, status, expires_at from public.my_pro_status()$$,
  $$values (true, null::text, null::text, null::timestamptz)$$,
  'granted Pro hides an expired subscription'
);
select lives_ok($$select public.require_pro()$$, 'granted Pro unlocks Pro actions');
select throws_ok($$select * from public.pro_grants$$, '42501', null, 'users cannot read grants');
select throws_ok($$select * from public.admin_pro_status$$, '42501', null, 'or the admin view');
select throws_ok($$select public.grant_pro('a@test.co', 'test')$$, '42501', null, 'or give Pro');
select throws_ok($$select public.revoke_pro('b@test.co')$$, '42501', null, 'or take it away');

reset role;
select ok(
  not has_table_privilege('anon', 'public.admin_pro_status', 'select')
    and not has_table_privilege('anon', 'public.pro_grants', 'select')
    and not has_function_privilege('anon', 'public.grant_pro(text, text, text, timestamptz)', 'execute'),
  'signed-out callers get none of it'
);

select lives_ok($$select public.revoke_pro('a@test.co', 'done')$$, 'revoke');
select is(pg_temp.source_of_a(), 'free', 'revoking ends it');
select is(
  (select count(*)::int from public.pro_grants where revoked_at is not null),
  3, 'every grant is kept'
);
select throws_ok($$select public.revoke_pro('a@test.co')$$, 'P0001', null, 'nothing left to revoke');

select * from finish();
rollback;
