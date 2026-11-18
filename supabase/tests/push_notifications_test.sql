-- Push tokens: only through the RPCs, only your own; and which activity
-- rows are worth a push.
begin;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

select lives_ok(
  $$select public.register_push_token('tok-1', 'android')$$,
  'you can register a device'
);
select throws_ok(
  $$select * from public.push_tokens$$,
  '42501', null, 'but not read tokens'
);
select throws_ok(
  $$insert into public.push_tokens (token, user_id, platform)
    values ('x', '00000000-0000-0000-0000-00000000000b', 'android')$$,
  '42501', null, 'or write them directly'
);
select throws_ok(
  $$select public.register_push_token('tok-2', 'web')$$,
  '23514', null, 'platform must be android or ios'
);

-- B signs in on the same phone: the token moves to them.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select public.register_push_token('tok-1', 'android');
-- A can't remove B's token.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select public.unregister_push_token('tok-1');

reset role;
select is(
  (select user_id::text from public.push_tokens where token = 'tok-1'),
  '00000000-0000-0000-0000-00000000000b',
  'a token belongs to whoever registered it last, and only they can remove it'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select public.unregister_push_token('tok-1');
reset role;
select is(
  (select count(*)::int from public.push_tokens), 0, 'unregistering removes it'
);

-- Which rows get a push.
select ok(
  public.should_push('expense_added', 'a0000000-0000-0000-0000-000000000000',
    null, 'b0000000-0000-0000-0000-000000000000', -500),
  'an expense that changes your balance'
);
select ok(
  not public.should_push('expense_added', 'a0000000-0000-0000-0000-000000000000',
    null, 'b0000000-0000-0000-0000-000000000000', 0),
  'not a group expense you are not on'
);
select ok(
  not public.should_push('expense_added', 'b0000000-0000-0000-0000-000000000000',
    null, 'b0000000-0000-0000-0000-000000000000', -500),
  'not your own action'
);
select ok(
  public.should_push('member_added', 'a0000000-0000-0000-0000-000000000000',
    'b0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 0),
  'being added to a group'
);
select ok(
  not public.should_push('member_added', 'a0000000-0000-0000-0000-000000000000',
    'c0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 0),
  'not someone else being added'
);

-- Without the Vault secrets, activity still logs (and nothing is sent).
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select public.register_push_token('tok-3', 'android');
reset role;
select lives_ok(
  $$select public.log_activity('member_added',
      array['00000000-0000-0000-0000-00000000000b']::uuid[], null, null,
      '00000000-0000-0000-0000-00000000000b')$$,
  'logging activity works with no push configured'
);

select * from finish();
rollback;
