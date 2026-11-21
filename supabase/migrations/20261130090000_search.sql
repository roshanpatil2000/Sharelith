-- Search your expenses and payments by description, notes, group name or
-- comment text. Same columns as list_expenses, newest first, at most 50.

create index if not exists expenses_description_lower_idx
  on public.expenses (lower(description));

create or replace function public.search_expenses(q text)
returns table (
  id uuid,
  group_id uuid,
  description text,
  amount_minor bigint,
  currency text,
  category text,
  expense_date date,
  is_payment boolean,
  created_by uuid,
  paid_by uuid,
  paid_to uuid,
  payer_count integer,
  my_net_minor bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with term as (
    -- Wildcards typed by the user match literally.
    select '%' || replace(replace(replace(lower(trim(q)), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select
    e.id, e.group_id, e.description, e.amount_minor, e.currency, e.category,
    e.expense_date, e.is_payment, e.created_by,
    (select min(p.user_id::text)::uuid from public.expense_payers p where p.expense_id = e.id),
    case when e.is_payment then
      (select min(s.user_id::text)::uuid from public.expense_shares s where s.expense_id = e.id)
    end,
    (select count(*)::integer from public.expense_payers p where p.expense_id = e.id),
    coalesce((select p.paid_minor from public.expense_payers p
              where p.expense_id = e.id and p.user_id = auth.uid()), 0)
      - coalesce((select s.owed_minor from public.expense_shares s
                  where s.expense_id = e.id and s.user_id = auth.uid()), 0)
  from public.expenses e, term
  where auth.uid() is not null
    and char_length(trim(q)) >= 2
    and e.deleted_at is null
    and public.can_see_expense(e.id)
    and (
      lower(e.description) like term.pat
      or lower(coalesce(e.notes, '')) like term.pat
      or exists (select 1 from public.groups g
                 where g.id = e.group_id and lower(g.name) like term.pat)
      or exists (select 1 from public.expense_comments c
                 where c.expense_id = e.id and lower(c.body) like term.pat)
    )
  order by e.expense_date desc, e.created_at desc
  limit 50;
$$;

revoke execute on function public.search_expenses(text) from public, anon;
grant execute on function public.search_expenses(text) to authenticated;
