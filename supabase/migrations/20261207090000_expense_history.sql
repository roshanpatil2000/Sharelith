-- Edit history: every change made with update_expense keeps a before and
-- after snapshot, readable by anyone who can see the expense.

create table public.expense_revisions (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  editor_id uuid references public.profiles (id) on delete set null,
  edited_at timestamptz not null default now(),
  before jsonb not null,
  after jsonb not null
);

create index expense_revisions_expense_idx
  on public.expense_revisions (expense_id, edited_at desc);

alter table public.expense_revisions enable row level security;

-- Written only by update_expense (security definer); read through
-- list_expense_revisions, but direct reads follow the expense too.
create policy "Revisions follow the expense"
  on public.expense_revisions for select to authenticated
  using (public.can_see_expense(expense_id));

revoke insert, update, delete on public.expense_revisions from anon, authenticated;

create or replace function public.expense_snapshot(eid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'description', e.description,
    'amount_minor', e.amount_minor,
    'currency', e.currency,
    'category', e.category,
    'expense_date', e.expense_date,
    'notes', e.notes,
    'payers', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'paid_minor', p.paid_minor)
                       order by p.user_id)
      from public.expense_payers p where p.expense_id = e.id
    ), '[]'::jsonb),
    'shares', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'owed_minor', s.owed_minor)
                       order by s.user_id)
      from public.expense_shares s where s.expense_id = e.id
    ), '[]'::jsonb)
  )
  from public.expenses e
  where e.id = eid;
$$;

revoke execute on function public.expense_snapshot(uuid) from public, anon, authenticated;

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
  snap_before jsonb;
  snap_after jsonb;
begin
  perform public.assert_expense_creator(eid);
  if exists (select 1 from public.expenses where id = eid and is_payment) then
    raise exception 'Payments can’t be edited. Delete it and record it again.'
      using errcode = 'P0001', hint = 'is_payment';
  end if;
  perform public.assert_expense_changeable(eid);
  before := public.expense_people(eid);
  snap_before := public.expense_snapshot(eid);

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

  snap_after := public.expense_snapshot(eid);
  if snap_after is distinct from snap_before then
    insert into public.expense_revisions (expense_id, editor_id, before, after)
    values (eid, auth.uid(), snap_before, snap_after);
  end if;

  -- People taken off the expense hear about it too.
  perform public.log_expense_activity(eid, 'expense_updated', before);
end;
$$;

-- Newest first, with the editor's name and the names of everyone in either
-- snapshot so the app can describe payer and share changes.
create or replace function public.list_expense_revisions(eid uuid)
returns table (
  id uuid,
  edited_at timestamptz,
  editor_id uuid,
  editor_name text,
  before jsonb,
  after jsonb,
  names jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.edited_at, r.editor_id,
         coalesce(p.full_name, 'Deleted user'),
         r.before, r.after,
         coalesce((
           select jsonb_object_agg(q.id, coalesce(q.full_name, 'Deleted user'))
           from public.profiles q
           where q.id in (
             select (x->>'user_id')::uuid
             from jsonb_array_elements(
               (r.before->'payers') || (r.before->'shares') || (r.after->'payers') || (r.after->'shares')
             ) x
           )
         ), '{}'::jsonb)
  from public.expense_revisions r
  left join public.profiles p on p.id = r.editor_id
  where r.expense_id = eid and public.can_see_expense(eid)
  order by r.edited_at desc;
$$;

revoke execute on function public.list_expense_revisions(uuid) from public, anon;
grant execute on function public.list_expense_revisions(uuid) to authenticated;
