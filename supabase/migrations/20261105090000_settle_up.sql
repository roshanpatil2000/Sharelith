-- Settling up: a payment is an expense the payer paid in full and the person
-- paid owes in full, so it cancels what the payer owed them.

create or replace function public.record_payment(
  payer uuid,
  payee uuid,
  amount_minor bigint,
  currency text,
  group_id uuid default null,
  expense_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if payer = payee then
    raise exception 'A payment needs two different people'
      using errcode = 'P0001', hint = 'invalid_expense';
  end if;
  -- Recording someone else's payment to a third person isn't yours to do.
  if auth.uid() not in (payer, payee) then
    raise exception 'You can only record payments you made or received'
      using errcode = '42501', hint = 'not_party';
  end if;

  insert into public.expenses (
    group_id, description, amount_minor, currency, category, expense_date,
    is_payment, created_by
  )
  values (
    record_payment.group_id,
    'Payment',
    record_payment.amount_minor,
    record_payment.currency,
    'payment',
    coalesce(record_payment.expense_date, current_date),
    true,
    auth.uid()
  )
  returning id into eid;

  perform public.save_expense_people(
    eid,
    record_payment.group_id,
    record_payment.amount_minor,
    jsonb_build_array(jsonb_build_object('user_id', payer, 'paid_minor', record_payment.amount_minor)),
    jsonb_build_array(jsonb_build_object('user_id', payee, 'owed_minor', record_payment.amount_minor))
  );
  return eid;
end;
$$;

-- A payment stays a payment: changing it means deleting and recording again.
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
  if exists (select 1 from public.expenses where id = eid and is_payment) then
    raise exception 'Payments can’t be edited. Delete it and record it again.'
      using errcode = 'P0001', hint = 'is_payment';
  end if;

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
  if exists (select 1 from public.expenses where id = eid and is_payment) then
    raise exception 'Payments can’t be renamed'
      using errcode = 'P0001', hint = 'is_payment';
  end if;
  update public.expenses
  set description = trim(rename_expense.description)
  where id = eid and deleted_at is null;
  if not found then
    raise exception 'Expense not found' using errcode = '42501', hint = 'not_found';
  end if;
end;
$$;

-- Every member's net in a group, per currency: + they're owed. Simplified
-- settle-up suggestions are worked out from these. Members only.
create or replace function public.list_group_balances(gid uuid)
returns table (user_id uuid, currency text, net_minor bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_group_member(gid) then
    raise exception 'You''re not in this group'
      using errcode = '42501', hint = 'not_member';
  end if;
  return query
    select person, e.currency, sum(value)::bigint
    from public.expense_debts d
    join public.expenses e on e.id = d.expense_id
    cross join lateral (
      values (d.creditor_id, d.amount_minor), (d.debtor_id, -d.amount_minor)
    ) as entry (person, value)
    where e.group_id = gid and e.deleted_at is null
    group by person, e.currency
    having sum(value) <> 0;
end;
$$;

-- list_expenses gains paid_to, so a payment row can say who was paid.
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
  paid_to uuid,
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
    case when e.is_payment then
      (select min(s.user_id::text)::uuid from public.expense_shares s where s.expense_id = e.id)
    end,
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

revoke execute on function public.list_expenses(uuid, uuid) from public, anon;
grant execute on function public.list_expenses(uuid, uuid) to authenticated;

revoke execute on function public.record_payment(uuid, uuid, bigint, text, uuid, date) from public, anon;
revoke execute on function public.list_group_balances(uuid) from public, anon;
grant execute on function public.record_payment(uuid, uuid, bigint, text, uuid, date) to authenticated;
grant execute on function public.list_group_balances(uuid) to authenticated;
