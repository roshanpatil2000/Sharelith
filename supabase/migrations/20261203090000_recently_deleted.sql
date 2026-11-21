-- Recently deleted: expenses and payments you deleted (only you can restore
-- them), newest first. Deleted groups' records stay out.

create or replace function public.list_deleted_expenses()
returns table (
  id uuid,
  group_id uuid,
  group_name text,
  description text,
  amount_minor bigint,
  currency text,
  category text,
  expense_date date,
  is_payment boolean,
  deleted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.group_id, g.name, e.description, e.amount_minor, e.currency,
         e.category, e.expense_date, e.is_payment, e.deleted_at
  from public.expenses e
  left join public.groups g on g.id = e.group_id
  where auth.uid() is not null
    and e.created_by = auth.uid()
    and e.deleted_at is not null
    and (e.group_id is null or g.archived_at is null)
  order by e.deleted_at desc
  limit 100;
$$;

revoke execute on function public.list_deleted_expenses() from public, anon;
grant execute on function public.list_deleted_expenses() to authenticated;
