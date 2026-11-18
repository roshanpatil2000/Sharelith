-- A new group pushes to the members it was created with, not its creator.
begin;
select plan(2);

select ok(
  public.should_push('group_created', 'a0000000-0000-0000-0000-000000000000',
    null, 'b0000000-0000-0000-0000-000000000000', 0),
  'members of a new group get a push'
);
select ok(
  not public.should_push('group_created', 'a0000000-0000-0000-0000-000000000000',
    null, 'a0000000-0000-0000-0000-000000000000', 0),
  'its creator does not'
);

select * from finish();
rollback;
