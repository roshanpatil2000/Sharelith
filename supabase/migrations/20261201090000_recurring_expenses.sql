-- Recurring expenses: whoever added an expense can make it repeat weekly,
-- monthly or yearly. A daily job adds the next copy on its date, copying the
-- latest one (so edits carry forward), with the same checks as adding it by
-- hand. If a copy can't be added (someone left the group, a friend was
-- removed, the latest copy was deleted), the repeat stops.

create extension if not exists pg_cron;

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  -- The newest copy: the template for the next one.
  last_expense_id uuid not null references public.expenses (id) on delete cascade,
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  -- Dates are start_date + n steps, so 31 Jan stays the month's end.
  start_date date not null,
  steps integer not null default 1,
  next_date date not null,
  created_at timestamptz not null default now()
);

create unique index recurring_expenses_last_idx on public.recurring_expenses (last_expense_id);

alter table public.recurring_expenses enable row level security;

-- Everyone on the expense can see that it repeats; changes go through functions.
create policy "People on the expense see its repeat"
  on public.recurring_expenses for select to authenticated
  using (public.can_see_expense(last_expense_id));
revoke all on public.recurring_expenses from anon;
grant select on public.recurring_expenses to authenticated;

create or replace function public.repeat_date(start_date date, frequency text, steps integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select (start_date + case frequency
    when 'weekly' then make_interval(weeks => steps)
    when 'monthly' then make_interval(months => steps)
    else make_interval(years => steps)
  end)::date;
$$;

-- Makes an expense repeat, changes how often, or stops it (frequency null).
create or replace function public.set_expense_repeat(eid uuid, frequency text)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.expenses;
  next_on date;
begin
  perform public.assert_expense_creator(eid);
  select * into e from public.expenses where id = eid and deleted_at is null;
  if e.id is null then
    raise exception 'Expense not found' using errcode = 'P0001', hint = 'not_found';
  end if;
  if e.is_payment then
    raise exception 'Payments can’t repeat' using errcode = 'P0001', hint = 'is_payment';
  end if;

  if frequency is null then
    delete from public.recurring_expenses where last_expense_id = eid;
    return null;
  end if;
  if frequency not in ('weekly', 'monthly', 'yearly') then
    raise exception 'Choose weekly, monthly or yearly' using errcode = '22023';
  end if;

  -- Next date after today, counting from the expense's own date.
  next_on := public.repeat_date(e.expense_date, frequency, 1);
  insert into public.recurring_expenses
    (created_by, last_expense_id, frequency, start_date, steps, next_date)
  values (auth.uid(), eid, frequency, e.expense_date, 1, next_on)
  on conflict (last_expense_id) do update
    set frequency = excluded.frequency, start_date = excluded.start_date,
        steps = 1, next_date = excluded.next_date;
  return next_on;
end;
$$;

-- Adds every copy that's due. Run daily by pg_cron; safe to run again.
create or replace function public.run_recurring_expenses()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recurring_expenses;
  e public.expenses;
  made uuid;
  added integer := 0;
begin
  for r in
    select * from public.recurring_expenses
    where next_date <= current_date
    order by next_date
    for update skip locked
  loop
    begin
      -- Act as the person who set it up, so the usual checks apply.
      perform set_config('request.jwt.claims',
        json_build_object('sub', r.created_by, 'role', 'authenticated')::text, true);
      loop
        select * into e from public.expenses
        where id = r.last_expense_id and deleted_at is null;
        if e.id is null then
          raise exception 'template gone';
        end if;
        made := public.create_expense(
          e.description, e.amount_minor, e.currency,
          (select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'paid_minor', p.paid_minor))
           from public.expense_payers p where p.expense_id = e.id),
          (select jsonb_agg(jsonb_build_object(
             'user_id', s.user_id, 'owed_minor', s.owed_minor,
             'split_type', s.split_type, 'raw_value', s.raw_value))
           from public.expense_shares s where s.expense_id = e.id),
          e.group_id, e.category, r.next_date, e.notes
        );
        added := added + 1;
        r.steps := r.steps + 1;
        r.last_expense_id := made;
        r.next_date := public.repeat_date(r.start_date, r.frequency, r.steps);
        update public.recurring_expenses
          set last_expense_id = made, steps = r.steps, next_date = r.next_date
          where id = r.id;
        exit when r.next_date > current_date;
      end loop;
    exception when others then
      -- Can't be added any more: stop repeating.
      delete from public.recurring_expenses where id = r.id;
    end;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  return added;
end;
$$;

revoke execute on function public.set_expense_repeat(uuid, text) from public, anon;
grant execute on function public.set_expense_repeat(uuid, text) to authenticated;
revoke execute on function public.run_recurring_expenses() from public, anon, authenticated;

-- 00:30 UTC is 06:00 in India.
select cron.schedule('recurring-expenses', '30 0 * * *', 'select public.run_recurring_expenses()');
