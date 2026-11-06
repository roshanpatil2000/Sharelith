-- Once someone has left a group, removed a friend or deleted their account,
-- the expenses and payments they were on can't change any more: changing them
-- would move a balance with someone who can no longer settle it.

-- Raises unless everyone on the expense, the caller included, can still
-- settle with each other: in a group, all still members; outside one, all
-- still the caller's friends.
create or replace function public.assert_expense_changeable(eid uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  gid uuid;
  people uuid[];
begin
  select e.group_id into gid from public.expenses e where e.id = eid;
  people := public.expense_people(eid);

  if gid is not null then
    if not public.is_group_member(gid) then
      raise exception 'You’ve left this group, so its expenses can’t be changed'
        using errcode = 'P0001', hint = 'locked';
    end if;
    if exists (
      select 1 from unnest(people) as person (id)
      where not exists (
        select 1 from public.group_members m
        where m.group_id = gid and m.user_id = person.id and m.left_at is null
      )
    ) then
      raise exception 'Someone on this expense has left the group, so it can’t be changed'
        using errcode = 'P0001', hint = 'locked';
    end if;
  elsif exists (
    select 1 from unnest(people) as person (id)
    where person.id <> auth.uid()
      and not exists (
        select 1 from public.friendships f
        where f.user_a = least(auth.uid(), person.id)
          and f.user_b = greatest(auth.uid(), person.id)
      )
  ) then
    raise exception 'You’re no longer friends with someone on this expense, so it can’t be changed'
      using errcode = 'P0001', hint = 'locked';
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
  before uuid[];
begin
  perform public.assert_expense_creator(eid);
  if exists (select 1 from public.expenses where id = eid and is_payment) then
    raise exception 'Payments can’t be edited. Delete it and record it again.'
      using errcode = 'P0001', hint = 'is_payment';
  end if;
  perform public.assert_expense_changeable(eid);
  before := public.expense_people(eid);

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
  perform public.log_expense_activity(eid, 'expense_updated', before);
end;
$$;

-- Deleting and restoring both move balances, so both need everyone present.
create or replace function public.set_expense_deleted(eid uuid, deleted boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment boolean;
begin
  perform public.assert_expense_creator(eid);
  perform public.assert_expense_changeable(eid);
  update public.expenses
  set deleted_at = case when deleted then now() end
  where id = eid
  returning is_payment into payment;
  perform public.log_expense_activity(
    eid,
    case
      when payment and deleted then 'payment_deleted'
      when payment then 'payment_restored'
      when deleted then 'expense_deleted'
      else 'expense_restored'
    end
  );
end;
$$;

-- A rename moves no money, but someone who has left a group shouldn't be
-- editing its expenses.
create or replace function public.rename_expense(eid uuid, description text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid;
begin
  if not public.can_see_expense(eid) then
    raise exception 'Expense not found' using errcode = '42501', hint = 'not_found';
  end if;
  if exists (select 1 from public.expenses where id = eid and is_payment) then
    raise exception 'Payments can’t be renamed'
      using errcode = 'P0001', hint = 'is_payment';
  end if;
  select e.group_id into gid from public.expenses e where e.id = eid;
  if gid is not null and not public.is_group_member(gid) then
    raise exception 'You’ve left this group, so its expenses can’t be changed'
      using errcode = 'P0001', hint = 'locked';
  end if;
  update public.expenses
  set description = trim(rename_expense.description)
  where id = eid and deleted_at is null;
  if not found then
    raise exception 'Expense not found' using errcode = '42501', hint = 'not_found';
  end if;
  perform public.log_expense_activity(eid, 'expense_updated');
end;
$$;

-- An account can only be deleted once nothing is owed either way: a deleted
-- account can't settle up, so the balance would be stuck forever.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.list_my_balances()) then
    raise exception 'Settle up with everyone before deleting your account'
      using errcode = 'P0001', hint = 'not_settled';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.assert_expense_changeable(uuid) from public, anon, authenticated;
