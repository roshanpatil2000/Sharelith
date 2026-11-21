-- Group totals: what a group spent (by month, category and currency) and what
-- each member paid and owes. For members of the group only. Payments are
-- not spending, so they're left out.

create or replace function public.group_spending(gid uuid)
returns table (
  month date,
  category text,
  currency text,
  total_minor bigint,
  my_share_minor bigint,
  my_paid_minor bigint,
  expense_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.is_group_member(gid) then
    raise exception 'You’re not in this group' using errcode = '42501', hint = 'not_member';
  end if;
  return query
  select date_trunc('month', e.expense_date)::date, e.category, e.currency,
         sum(e.amount_minor)::bigint,
         sum(coalesce((select s.owed_minor from public.expense_shares s
                       where s.expense_id = e.id and s.user_id = me), 0))::bigint,
         sum(coalesce((select p.paid_minor from public.expense_payers p
                       where p.expense_id = e.id and p.user_id = me), 0))::bigint,
         count(*)::integer
  from public.expenses e
  where e.group_id = gid and not e.is_payment and e.deleted_at is null
  group by 1, 2, 3
  order by 1, 2, 3;
end;
$$;

create or replace function public.group_member_spending(gid uuid)
returns table (
  user_id uuid,
  currency text,
  paid_minor bigint,
  share_minor bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.is_group_member(gid) then
    raise exception 'You’re not in this group' using errcode = '42501', hint = 'not_member';
  end if;
  return query
  with live as (
    select e.id, e.currency from public.expenses e
    where e.group_id = gid and not e.is_payment and e.deleted_at is null
  ),
  paid as (
    select p.user_id as person, l.currency as cur, sum(p.paid_minor) as amount
    from live l join public.expense_payers p on p.expense_id = l.id
    group by 1, 2
  ),
  owed as (
    select s.user_id as person, l.currency as cur, sum(s.owed_minor) as amount
    from live l join public.expense_shares s on s.expense_id = l.id
    group by 1, 2
  )
  select coalesce(paid.person, owed.person), coalesce(paid.cur, owed.cur),
         coalesce(paid.amount, 0)::bigint, coalesce(owed.amount, 0)::bigint
  from paid full join owed on paid.person = owed.person and paid.cur = owed.cur
  order by 3 desc;
end;
$$;

revoke execute on function public.group_spending(uuid) from public, anon;
revoke execute on function public.group_member_spending(uuid) from public, anon;
grant execute on function public.group_spending(uuid) to authenticated;
grant execute on function public.group_member_spending(uuid) to authenticated;
