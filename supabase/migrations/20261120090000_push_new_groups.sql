-- Being put into a new group is also "added to a group": creating one logs
-- group_created for every member, so push that too (except to its creator).

create or replace function public.should_push(
  kind text,
  actor uuid,
  subject uuid,
  recipient uuid,
  net bigint
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select recipient is distinct from actor and (
    net <> 0
    or kind = 'group_created'
    or (kind in ('member_added', 'member_removed') and subject = recipient)
  );
$$;
