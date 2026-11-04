-- Only whoever added an expense can change its amounts and split, or delete
-- it. Anyone who can see it may rename it.

create or replace function public.assert_expense_creator(eid uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_see_expense(eid) then
    raise exception 'Expense not found' using errcode = '42501', hint = 'not_found';
  end if;
  if not exists (
    select 1 from public.expenses where id = eid and created_by = auth.uid()
  ) then
    raise exception 'Only the person who added this expense can change its amount or delete it'
      using errcode = '42501', hint = 'not_creator';
  end if;
end;
$$;

create or replace function public.update_expense(
  eid uuid,
  description text,
  amount_minor bigint,
  currency text,
  payers jsonb,
  shares jsonb,
  category text default 'general',
  expense_date date default null,
  notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid;
begin
  perform public.assert_expense_creator(eid);

  update public.expenses e
  set description = trim(update_expense.description),
      amount_minor = update_expense.amount_minor,
      currency = update_expense.currency,
      category = coalesce(update_expense.category, 'general'),
      expense_date = coalesce(update_expense.expense_date, e.expense_date),
      notes = nullif(trim(update_expense.notes), '')
  where e.id = eid and e.deleted_at is null
  returning e.group_id into gid;

  if not found then
    raise exception 'Expense not found' using errcode = '42501', hint = 'not_found';
  end if;

  perform public.save_expense_people(
    eid, gid, update_expense.amount_minor, payers, shares
  );
end;
$$;

-- Deleting and restoring are both the creator's.
create or replace function public.set_expense_deleted(eid uuid, deleted boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_expense_creator(eid);
  update public.expenses
  set deleted_at = case when deleted then now() end
  where id = eid;
end;
$$;

create or replace function public.rename_expense(eid uuid, description text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_see_expense(eid) then
    raise exception 'Expense not found' using errcode = '42501', hint = 'not_found';
  end if;
  update public.expenses
  set description = trim(rename_expense.description)
  where id = eid and deleted_at is null;
  if not found then
    raise exception 'Expense not found' using errcode = '42501', hint = 'not_found';
  end if;
end;
$$;

-- list_expenses gains created_by, so the app knows whose expense it is.
drop function public.list_expenses(uuid, uuid);

create function public.list_expenses(gid uuid default null, friend uuid default null)
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
  payer_count integer,
  my_net_minor bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id, e.group_id, e.description, e.amount_minor, e.currency, e.category,
    e.expense_date, e.is_payment, e.created_by,
    (select min(p.user_id::text)::uuid from public.expense_payers p where p.expense_id = e.id),
    (select count(*)::integer from public.expense_payers p where p.expense_id = e.id),
    coalesce((select p.paid_minor from public.expense_payers p
              where p.expense_id = e.id and p.user_id = auth.uid()), 0)
      - coalesce((select s.owed_minor from public.expense_shares s
                  where s.expense_id = e.id and s.user_id = auth.uid()), 0)
  from public.expenses e
  where e.deleted_at is null
    and public.can_see_expense(e.id)
    and (gid is null or e.group_id = gid)
    and (
      friend is null
      or exists (
        select 1 from public.expense_debts d
        where d.expense_id = e.id
          and ((d.debtor_id = auth.uid() and d.creditor_id = friend)
            or (d.creditor_id = auth.uid() and d.debtor_id = friend))
      )
    )
  order by e.expense_date desc, e.created_at desc
  limit 200;
$$;

revoke execute on function public.assert_expense_creator(uuid) from public, anon, authenticated;
revoke execute on function public.rename_expense(uuid, text) from public, anon;
revoke execute on function public.list_expenses(uuid, uuid) from public, anon;
grant execute on function public.rename_expense(uuid, text) to authenticated;
grant execute on function public.list_expenses(uuid, uuid) to authenticated;
