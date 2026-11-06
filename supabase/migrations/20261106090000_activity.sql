-- Activity: a record of who did what, and a row per person it concerns.
-- Each person's row also says what it did to them, and is what realtime
-- listens to: a new row means that person's balances may have changed.

create table public.activities (
  id bigint generated always as identity primary key,
  kind text not null check (kind in (
    'expense_added', 'expense_updated', 'expense_deleted', 'expense_restored',
    'payment_added', 'payment_deleted', 'payment_restored',
    'group_created', 'member_added', 'member_left', 'member_removed'
  )),
  actor_id uuid references public.profiles (id),
  group_id uuid references public.groups (id) on delete set null,
  expense_id uuid references public.expenses (id) on delete set null,
  -- Who a member change was about.
  subject_id uuid references public.profiles (id),
  -- As they were at the time; groups and expenses can change or go.
  group_name text,
  description text,
  amount_minor bigint,
  currency text,
  created_at timestamptz not null default now()
);

create table public.activity_recipients (
  activity_id bigint not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- What it did to this person: + they lent, − they borrowed. 0 if nothing.
  net_minor bigint not null default 0,
  primary key (activity_id, user_id)
);

create index activity_recipients_user_idx
  on public.activity_recipients (user_id, activity_id desc);

alter table public.activities enable row level security;
alter table public.activity_recipients enable row level security;

create policy "Recipients can read their activity"
  on public.activity_recipients for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Recipients can read what happened"
  on public.activities for select to authenticated
  using (exists (
    select 1 from public.activity_recipients r
    where r.activity_id = activities.id and r.user_id = (select auth.uid())
  ));

revoke insert, update, delete on public.activities from anon, authenticated;
revoke insert, update, delete on public.activity_recipients from anon, authenticated;

-- Records an activity for the given people. nets maps user id to net_minor.
create or replace function public.log_activity(
  kind text,
  people uuid[],
  gid uuid default null,
  eid uuid default null,
  subject uuid default null,
  nets jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  aid bigint;
begin
  insert into public.activities (
    kind, actor_id, group_id, expense_id, subject_id,
    group_name, description, amount_minor, currency
  )
  select
    log_activity.kind, auth.uid(), log_activity.gid, log_activity.eid,
    log_activity.subject,
    (select g.name from public.groups g where g.id = log_activity.gid),
    e.description, e.amount_minor, e.currency
  from (select 1) one
  left join public.expenses e on e.id = log_activity.eid
  returning id into aid;

  insert into public.activity_recipients (activity_id, user_id, net_minor)
  select aid, p.id, coalesce((nets ->> p.id::text)::bigint, 0)
  from (select distinct unnest(people) as id) p
  where p.id is not null;
end;
$$;

-- Everyone on an expense (and anyone who was on it before an edit), with what
-- it does to each of them now.
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
    kind, people || coalesce(before, '{}'), gid, eid, null, nets
  );
end;
$$;

create or replace function public.expense_people(eid uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct id), '{}')
  from (
    select user_id as id from public.expense_payers where expense_id = eid
    union all
    select user_id from public.expense_shares where expense_id = eid
  ) people;
$$;

create or replace function public.active_member_ids(gid uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(user_id), '{}')
  from public.group_members
  where group_id = gid and left_at is null;
$$;

-- The expense and payment RPCs, now each leaving a record.

create or replace function public.create_expense(
  description text,
  amount_minor bigint,
  currency text,
  payers jsonb,
  shares jsonb,
  group_id uuid default null,
  category text default 'general',
  expense_date date default null,
  notes text default null
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

  insert into public.expenses (
    group_id, description, amount_minor, currency, category, expense_date, notes, created_by
  )
  values (
    create_expense.group_id,
    trim(create_expense.description),
    create_expense.amount_minor,
    create_expense.currency,
    coalesce(create_expense.category, 'general'),
    coalesce(create_expense.expense_date, current_date),
    nullif(trim(create_expense.notes), ''),
    auth.uid()
  )
  returning id into eid;

  perform public.save_expense_people(
    eid, create_expense.group_id, create_expense.amount_minor, payers, shares
  );
  perform public.log_expense_activity(eid, 'expense_added');
  return eid;
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
  -- People taken off the expense hear about it too.
  perform public.log_expense_activity(eid, 'expense_updated', before);
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
  perform public.log_expense_activity(eid, 'expense_updated');
end;
$$;

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
  perform public.log_expense_activity(eid, 'payment_added');
  return eid;
end;
$$;

-- Group membership, each change recorded for everyone in the group.

create or replace function public.create_group(
  name text,
  type text default 'other',
  description text default null,
  member_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  gid uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform public.assert_all_friends(member_ids);

  insert into public.groups (name, type, description, currency, created_by)
  select trim(create_group.name),
         coalesce(create_group.type, 'other'),
         nullif(trim(create_group.description), ''),
         p.default_currency,
         me
  from public.profiles p
  where p.id = me
  returning id into gid;

  insert into public.group_members (group_id, user_id, added_by)
  select gid, m.id, me
  from (select me as id union select unnest(coalesce(member_ids, '{}'))) m
  on conflict do nothing;

  perform public.befriend_group_members(gid, coalesce(member_ids, '{}'));
  perform public.log_activity('group_created', public.active_member_ids(gid), gid);
  return gid;
end;
$$;

create or replace function public.add_group_members(gid uuid, member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  added uuid[];
  person uuid;
begin
  perform public.assert_group_admin(gid);
  perform public.assert_all_friends(member_ids);

  with saved as (
    insert into public.group_members as gm (group_id, user_id, added_by)
    select gid, m.id, auth.uid()
    from unnest(coalesce(member_ids, '{}')) as m (id)
    on conflict (group_id, user_id) do update
      set left_at = null, joined_at = now(), added_by = auth.uid()
      where gm.left_at is not null
    returning user_id
  )
  select coalesce(array_agg(user_id), '{}') into added from saved;

  perform public.befriend_group_members(gid, added);
  update public.groups set updated_at = now() where id = gid;

  foreach person in array added loop
    perform public.log_activity(
      'member_added', public.active_member_ids(gid), gid, null, person
    );
  end loop;
end;
$$;

create or replace function public.remove_group_member(gid uuid, member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  members uuid[];
begin
  perform public.assert_group_admin(gid);
  if member = auth.uid() then
    raise exception 'Leave the group instead of removing yourself'
      using errcode = 'P0001', hint = 'remove_self';
  end if;
  if not public.is_settled_in_group(gid, member) then
    raise exception 'They need to settle up first'
      using errcode = 'P0001', hint = 'not_settled';
  end if;
  -- Before they go, so they hear about it too.
  members := public.active_member_ids(gid);
  update public.group_members set left_at = now()
  where group_id = gid and user_id = member and left_at is null;
  if found then
    perform public.log_activity('member_removed', members, gid, null, member);
  end if;
end;
$$;

create or replace function public.leave_group(gid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  members uuid[];
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.is_settled_in_group(gid, auth.uid()) then
    raise exception 'Settle up before leaving this group'
      using errcode = 'P0001', hint = 'not_settled';
  end if;
  members := public.active_member_ids(gid);
  -- Logged first: the group may close once its last member leaves.
  if auth.uid() = any (members) then
    perform public.log_activity(
      'member_left', members, gid, null, auth.uid()
    );
  end if;
  update public.group_members set left_at = now()
  where group_id = gid and user_id = auth.uid() and left_at is null;
end;
$$;

-- Your feed, newest first. Pass the last id you have to get older ones.
create or replace function public.list_activity(
  before_id bigint default null,
  max_rows integer default 50
)
returns table (
  id bigint,
  kind text,
  created_at timestamptz,
  actor_id uuid,
  actor_name text,
  subject_id uuid,
  subject_name text,
  group_id uuid,
  group_name text,
  expense_id uuid,
  description text,
  amount_minor bigint,
  currency text,
  net_minor bigint,
  paid_by uuid,
  payer_name text,
  paid_to uuid,
  payee_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id, a.kind, a.created_at,
    a.actor_id, actor.full_name,
    a.subject_id, subject.full_name,
    a.group_id, a.group_name,
    a.expense_id, a.description, a.amount_minor, a.currency,
    r.net_minor,
    pay.user_id, payer.full_name,
    owe.user_id, payee.full_name
  from public.activity_recipients r
  join public.activities a on a.id = r.activity_id
  left join public.profiles actor on actor.id = a.actor_id
  left join public.profiles subject on subject.id = a.subject_id
  left join public.expenses e on e.id = a.expense_id and e.is_payment
  left join public.expense_payers pay on pay.expense_id = e.id
  left join public.profiles payer on payer.id = pay.user_id
  left join public.expense_shares owe on owe.expense_id = e.id
  left join public.profiles payee on payee.id = owe.user_id
  where r.user_id = auth.uid()
    and (before_id is null or r.activity_id < before_id)
  order by r.activity_id desc
  limit least(greatest(coalesce(max_rows, 50), 1), 100);
$$;

-- Realtime: each person hears about their own new rows. Hosted Supabase has
-- this publication; local test databases may not.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.activity_recipients;
  end if;
end;
$$;

revoke execute on function public.log_activity(text, uuid[], uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.log_expense_activity(uuid, text, uuid[]) from public, anon, authenticated;
revoke execute on function public.expense_people(uuid) from public, anon, authenticated;
revoke execute on function public.active_member_ids(uuid) from public, anon, authenticated;
revoke execute on function public.list_activity(bigint, integer) from public, anon;
grant execute on function public.list_activity(bigint, integer) to authenticated;
