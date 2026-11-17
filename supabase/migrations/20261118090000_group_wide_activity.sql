-- Group expenses and payments now reach everyone in the group, not only the
-- people on them, so each member's feed and live updates follow the whole
-- group. Members not on an expense get net_minor 0 ("not involved").
-- Expenses outside a group still reach only the people on them.

create or replace function public.log_expense_activity(
  eid uuid,
  kind text,
  before uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  people uuid[];
  nets jsonb;
  gid uuid;
begin
  select e.group_id into gid from public.expenses e where e.id = eid;

  with per_person as (
    select user_id, sum(value)::bigint as net
    from (
      select p.user_id, p.paid_minor as value
      from public.expense_payers p where p.expense_id = eid
      union all
      select s.user_id, -s.owed_minor
      from public.expense_shares s where s.expense_id = eid
    ) rows
    group by user_id
  )
  select
    coalesce(array_agg(user_id), '{}'),
    coalesce(jsonb_object_agg(user_id, net), '{}')
  into people, nets
  from per_person;

  perform public.log_activity(
    kind,
    people
      || coalesce(before, '{}')
      || case when gid is null then '{}'::uuid[] else public.active_member_ids(gid) end,
    gid, eid, null, nets
  );
end;
$$;
