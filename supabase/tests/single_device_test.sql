-- Single device: ending other sessions keeps the current one and touches
-- nobody else's; the app can't call it.
begin;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.co', '{"full_name":"B"}');
insert into auth.sessions (id, user_id) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000b');

select is(
  public.end_other_sessions('00000000-0000-0000-0000-00000000000a',
    '10000000-0000-0000-0000-000000000001'),
  2, 'ends the other two sessions'
);
select is(
  (select count(*)::int from auth.sessions where user_id = '00000000-0000-0000-0000-00000000000a'),
  1, 'keeps the current session'
);
select ok(
  exists (select 1 from auth.sessions where id = '10000000-0000-0000-0000-000000000004'),
  'leaves other people signed in'
);
select ok(
  not has_function_privilege('authenticated', 'public.end_other_sessions(uuid, uuid)', 'execute'),
  'the app cannot call it'
);
select ok(
  has_function_privilege('service_role', 'public.end_other_sessions(uuid, uuid)', 'execute'),
  'the edge function can'
);

select * from finish();
rollback;
