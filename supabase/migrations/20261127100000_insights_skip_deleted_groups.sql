-- Insights leave out expenses in deleted (archived) groups.

create or replace function public.spending_insights(months integer default 12)
returns table (
  month date,
  category text,
  currency text,
  share_minor bigint,
  paid_minor bigint,
  expense_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  since date;
begin
  perform public.require_pro();
  if months is null or months < 1 or months > 24 then
    raise exception 'Choose between 1 and 24 months' using errcode = '22023', hint = 'bad_months';
  end if;
  since := (date_trunc('month', current_date) - make_interval(months => months - 1))::date;

  return query
  with mine as (
    select e.id, date_trunc('month', e.expense_date)::date as m, e.category as cat, e.currency as cur,
           coalesce((select s.owed_minor from public.expense_shares s where s.expense_id = e.id and s.user_id = me), 0) as share,
           coalesce((select p.paid_minor from public.expense_payers p where p.expense_id = e.id and p.user_id = me), 0) as paid
    from public.expenses e
    where not e.is_payment
      and e.deleted_at is null
      and e.expense_date >= since
      -- Deleted groups are archived to keep their records; leave them out.
      and (e.group_id is null or exists (
        select 1 from public.groups g where g.id = e.group_id and g.archived_at is null
      ))
      and (
        exists (select 1 from public.expense_shares s where s.expense_id = e.id and s.user_id = me)
        or exists (select 1 from public.expense_payers p where p.expense_id = e.id and p.user_id = me)
      )
  )
  select m, cat, cur, sum(share)::bigint, sum(paid)::bigint, count(*)::integer
  from mine
  group by m, cat, cur
  order by m, cat, cur;
end;
$$;

revoke execute on function public.spending_insights(integer) from public, anon;
grant execute on function public.spending_insights(integer) to authenticated;
