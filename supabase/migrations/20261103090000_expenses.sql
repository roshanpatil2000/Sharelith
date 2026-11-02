-- Expenses, and the changes that keep them safe. Financial records outlive
-- memberships, groups and accounts: leaving a group is a soft change, a group
-- with expenses is archived rather than deleted, and a deleted account leaves
-- an anonymous profile so other people's balances still add up.

-- Memberships and groups end softly.
alter table public.group_members add column left_at timestamptz;
alter table public.groups add column archived_at timestamptz;
alter table public.profiles add column deleted_at timestamptz;

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and left_at is null
  );
$$;

drop policy "Members can read their groups" on public.groups;
create policy "Members can read their groups"
  on public.groups for select
  to authenticated
  using (archived_at is null and public.is_group_member(id));

-- Former members stay readable: their names appear on past expenses.
drop policy "Group members can read each other's profile" on public.profiles;
create policy "Group members can read each other's profile"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.group_members mine
      join public.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = (select auth.uid())
        and mine.left_at is null
        and theirs.user_id = profiles.id
    )
  );

create or replace function public.befriend_group_members(gid uuid, new_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.friendships (user_a, user_b, created_by)
  select least(m.user_id, n.id), greatest(m.user_id, n.id), null
  from public.group_members m
  cross join unnest(new_ids) as n (id)
  where m.group_id = gid and m.left_at is null and m.user_id <> n.id
  on conflict do nothing;
$$;

-- Adding someone who left brings their old membership back.
create or replace function public.add_group_members(gid uuid, member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  added uuid[];
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
end;
$$;

-- The expenses themselves. All writes go through the RPCs below.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete restrict,
  description text not null check (char_length(trim(description)) between 1 and 200),
  amount_minor bigint not null check (amount_minor between 1 and 100000000000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  category text not null default 'general',
  expense_date date not null default current_date,
  notes text check (char_length(notes) <= 1000),
  is_payment boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index expenses_group_idx on public.expenses (group_id, expense_date desc);

create trigger set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

create table public.expense_payers (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  paid_minor bigint not null check (paid_minor > 0),
  primary key (expense_id, user_id)
);

create index expense_payers_user_idx on public.expense_payers (user_id);

-- raw_value keeps what was entered (a percentage, shares, an adjustment) so
-- an edit can show it again.
create table public.expense_shares (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  owed_minor bigint not null check (owed_minor >= 0),
  split_type text not null default 'equal'
    check (split_type in ('equal', 'exact', 'percent', 'shares', 'adjustment')),
  raw_value numeric,
  primary key (expense_id, user_id)
);

create index expense_shares_user_idx on public.expense_shares (user_id);

-- Who owes whom for each expense, worked out once when it's saved. Balances
-- are sums over these rows.
create table public.expense_debts (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  debtor_id uuid not null references public.profiles (id),
  creditor_id uuid not null references public.profiles (id),
  amount_minor bigint not null check (amount_minor > 0),
  primary key (expense_id, debtor_id, creditor_id)
);

create index expense_debts_debtor_idx on public.expense_debts (debtor_id);
create index expense_debts_creditor_idx on public.expense_debts (creditor_id);

create or replace function public.can_see_expense(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.expenses e
    where e.id = eid
      and (
        (e.group_id is not null and public.is_group_member(e.group_id))
        or exists (
          select 1 from public.expense_shares s
          where s.expense_id = eid and s.user_id = auth.uid()
        )
        or exists (
          select 1 from public.expense_payers p
          where p.expense_id = eid and p.user_id = auth.uid()
        )
      )
  );
$$;

alter table public.expenses enable row level security;
alter table public.expense_payers enable row level security;
alter table public.expense_shares enable row level security;
alter table public.expense_debts enable row level security;

create policy "Participants can read expenses"
  on public.expenses for select to authenticated
  using (public.can_see_expense(id));
create policy "Participants can read payers"
  on public.expense_payers for select to authenticated
  using (public.can_see_expense(expense_id));
create policy "Participants can read shares"
  on public.expense_shares for select to authenticated
  using (public.can_see_expense(expense_id));
create policy "Participants can read debts"
  on public.expense_debts for select to authenticated
  using (public.can_see_expense(expense_id));

revoke insert, update, delete on public.expenses from anon, authenticated;
revoke insert, update, delete on public.expense_payers from anon, authenticated;
revoke insert, update, delete on public.expense_shares from anon, authenticated;
revoke insert, update, delete on public.expense_debts from anon, authenticated;

-- People on the same expense keep each other's names, even if they're no
-- longer friends or in the same group.
create policy "Expense participants can read each other's profile"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1
      from public.expense_debts d
      where (d.debtor_id = (select auth.uid()) and d.creditor_id = profiles.id)
         or (d.creditor_id = (select auth.uid()) and d.debtor_id = profiles.id)
    )
  );

-- Keep in step with settleNet in src/domain/balances.ts: debtors and creditors
-- are paired in id order.
create or replace function public.compute_expense_debts(eid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  debtors uuid[];
  owing bigint[];
  creditors uuid[];
  owed bigint[];
  d integer := 1;
  c integer := 1;
  amount bigint;
begin
  delete from public.expense_debts where expense_id = eid;

  with net as (
    select id, sum(value)::bigint as value
    from (
      select user_id as id, paid_minor as value
      from public.expense_payers where expense_id = eid
      union all
      select user_id, -owed_minor
      from public.expense_shares where expense_id = eid
    ) entries
    group by id
  )
  select
    array_agg(id order by id) filter (where value < 0),
    array_agg(-value order by id) filter (where value < 0),
    array_agg(id order by id) filter (where value > 0),
    array_agg(value order by id) filter (where value > 0)
  into debtors, owing, creditors, owed
  from net;

  while d <= coalesce(array_length(debtors, 1), 0)
    and c <= coalesce(array_length(creditors, 1), 0)
  loop
    amount := least(owing[d], owed[c]);
    insert into public.expense_debts (expense_id, debtor_id, creditor_id, amount_minor)
    values (eid, debtors[d], creditors[c], amount);
    owing[d] := owing[d] - amount;
    owed[c] := owed[c] - amount;
    if owing[d] = 0 then
      d := d + 1;
    end if;
    if owed[c] = 0 then
      c := c + 1;
    end if;
  end loop;
end;
$$;

-- Checks payers and shares, then stores them with their debts. Nothing here
-- trusts the app's arithmetic.
create or replace function public.save_expense_people(
  eid uuid,
  gid uuid,
  total bigint,
  payers jsonb,
  shares jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  people uuid[];
begin
  if jsonb_typeof(payers) is distinct from 'array'
    or jsonb_typeof(shares) is distinct from 'array'
    or jsonb_array_length(payers) = 0
    or jsonb_array_length(shares) = 0
  then
    raise exception 'An expense needs someone who paid and someone who owes'
      using errcode = 'P0001', hint = 'invalid_expense';
  end if;

  if (select coalesce(sum((p ->> 'paid_minor')::bigint), 0) from jsonb_array_elements(payers) p) <> total then
    raise exception 'What people paid must add up to the total'
      using errcode = 'P0001', hint = 'invalid_expense';
  end if;
  if (select coalesce(sum((s ->> 'owed_minor')::bigint), 0) from jsonb_array_elements(shares) s) <> total then
    raise exception 'The split must add up to the total'
      using errcode = 'P0001', hint = 'invalid_expense';
  end if;

  select array_agg(distinct id) into people
  from (
    select (p ->> 'user_id')::uuid as id from jsonb_array_elements(payers) p
    union all
    select (s ->> 'user_id')::uuid from jsonb_array_elements(shares) s
  ) everyone;

  if gid is not null then
    if not public.is_group_member(gid) then
      raise exception 'You''re not in this group'
        using errcode = '42501', hint = 'not_member';
    end if;
    if exists (
      select 1 from unnest(people) as person (id)
      where not exists (
        select 1 from public.group_members m
        where m.group_id = gid and m.user_id = person.id and m.left_at is null
      )
    ) then
      raise exception 'Everyone on the expense must be in the group'
        using errcode = 'P0001', hint = 'invalid_expense';
    end if;
  else
    if not me = any (people) then
      raise exception 'You must be part of the expense'
        using errcode = 'P0001', hint = 'invalid_expense';
    end if;
    perform public.assert_all_friends(people);
  end if;

  delete from public.expense_payers where expense_id = eid;
  delete from public.expense_shares where expense_id = eid;

  insert into public.expense_payers (expense_id, user_id, paid_minor)
  select eid, x.user_id, x.paid_minor
  from jsonb_to_recordset(payers) as x (user_id uuid, paid_minor bigint);

  insert into public.expense_shares (expense_id, user_id, owed_minor, split_type, raw_value)
  select eid, x.user_id, x.owed_minor, coalesce(x.split_type, 'equal'), x.raw_value
  from jsonb_to_recordset(shares)
    as x (user_id uuid, owed_minor bigint, split_type text, raw_value numeric);

  perform public.compute_expense_debts(eid);
end;
$$;

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
begin
  if not public.can_see_expense(eid) then
    raise exception 'Expense not found' using errcode = '42501', hint = 'not_found';
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

create or replace function public.set_expense_deleted(eid uuid, deleted boolean)
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
  set deleted_at = case when deleted then now() end
  where id = eid;
end;
$$;

-- Your balance with each person, per group and currency: + they owe you.
-- group_id is null for expenses outside any group.
create or replace function public.list_my_balances()
returns table (friend_id uuid, group_id uuid, currency text, net_minor bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when d.creditor_id = auth.uid() then d.debtor_id else d.creditor_id end,
    e.group_id,
    e.currency,
    sum(case when d.creditor_id = auth.uid() then d.amount_minor else -d.amount_minor end)::bigint
  from public.expense_debts d
  join public.expenses e on e.id = d.expense_id
  where e.deleted_at is null
    and auth.uid() in (d.debtor_id, d.creditor_id)
  group by 1, 2, 3
  having sum(case when d.creditor_id = auth.uid() then d.amount_minor else -d.amount_minor end) <> 0;
$$;

-- Newest first, for a group or for what you share with a friend. my_net_minor
-- is what the expense did to you: + you lent, − you borrowed.
create or replace function public.list_expenses(gid uuid default null, friend uuid default null)
returns table (
  id uuid,
  group_id uuid,
  description text,
  amount_minor bigint,
  currency text,
  category text,
  expense_date date,
  is_payment boolean,
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
    e.expense_date, e.is_payment,
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

-- Settled means nothing owed in any currency.
create or replace function public.is_settled_in_group(gid uuid, person uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.expense_debts d
    join public.expenses e on e.id = d.expense_id
    where e.group_id = gid
      and e.deleted_at is null
      and person in (d.debtor_id, d.creditor_id)
    group by e.currency
    having sum(case when d.creditor_id = person then d.amount_minor else -d.amount_minor end) <> 0
  );
$$;

create or replace function public.remove_group_member(gid uuid, member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
  update public.group_members set left_at = now()
  where group_id = gid and user_id = member and left_at is null;
end;
$$;

create or replace function public.leave_group(gid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.is_settled_in_group(gid, auth.uid()) then
    raise exception 'Settle up before leaving this group'
      using errcode = 'P0001', hint = 'not_settled';
  end if;
  update public.group_members set left_at = now()
  where group_id = gid and user_id = auth.uid() and left_at is null;
end;
$$;

-- A group with expenses is archived so the records survive.
create or replace function public.close_group(gid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.expenses e where e.group_id = gid) then
    update public.groups set archived_at = now() where id = gid;
  else
    delete from public.groups where id = gid;
  end if;
end;
$$;

create or replace function public.delete_group(gid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_group_admin(gid);
  if exists (
    select 1 from public.group_members m
    where m.group_id = gid and not public.is_settled_in_group(gid, m.user_id)
  ) then
    raise exception 'Everyone needs to settle up before the group can be deleted'
      using errcode = 'P0001', hint = 'not_settled';
  end if;
  perform public.close_group(gid);
end;
$$;

-- Removes a friendship once nothing is owed between you, in any currency.
create or replace function public.remove_friend(friend uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.list_my_balances() b where b.friend_id = friend
    group by b.currency
    having sum(b.net_minor) <> 0
  ) then
    raise exception 'Settle up before removing this friend'
      using errcode = 'P0001', hint = 'not_settled';
  end if;
  delete from public.friendships
  where user_a = least(auth.uid(), friend)
    and user_b = greatest(auth.uid(), friend);
end;
$$;

-- Archived groups have no members left to remove their cover.
create or replace function public.is_orphan_group_cover(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folder text := (storage.foldername(object_name))[1];
begin
  if folder is null or folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return not exists (
    select 1 from public.groups where id = folder::uuid and archived_at is null
  );
end;
$$;

-- After someone leaves: close the group if it's empty, otherwise make sure it
-- has an admin who is still in it and has actually joined.
create or replace function public.after_group_member_left()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.group_members
    where group_id = new.group_id and left_at is null
  ) then
    perform public.close_group(new.group_id);
  else
    update public.groups g
    set created_by = (
      select m.user_id
      from public.group_members m
      join public.profiles p on p.id = m.user_id
      where m.group_id = g.id and m.left_at is null
      order by p.joined_at is null, m.joined_at, m.user_id
      limit 1
    )
    where g.id = new.group_id
      and (
        g.created_by is null
        or not exists (
          select 1 from public.group_members m
          where m.group_id = g.id and m.user_id = g.created_by and m.left_at is null
        )
      );
  end if;
  return null;
end;
$$;

drop trigger after_group_member_removed on public.group_members;
drop function public.after_group_member_removed();

create trigger after_group_member_left
  after update of left_at on public.group_members
  for each row
  when (old.left_at is null and new.left_at is not null)
  execute function public.after_group_member_left();

-- Deleting an account keeps an anonymous profile for other people's balances.
-- The profile no longer depends on the auth user.
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- Mirroring a name change would touch the auth user while it's being deleted.
drop trigger sync_display_name on public.profiles;
create trigger sync_display_name
  after update of full_name on public.profiles
  for each row
  when (old.full_name is distinct from new.full_name and new.deleted_at is null)
  execute function public.sync_display_name();

create or replace function public.anonymize_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.group_members set left_at = now()
  where user_id = old.id and left_at is null;

  delete from public.friendships where old.id in (user_a, user_b);
  delete from public.friend_add_attempts where user_id = old.id;

  update public.profiles
  set full_name = 'Deleted user',
      email = null,
      phone = null,
      avatar_url = null,
      deleted_at = now()
  where id = old.id;
  return old;
end;
$$;

create trigger anonymize_deleted_user
  before delete on auth.users
  for each row execute function public.anonymize_deleted_user();

revoke execute on function public.can_see_expense(uuid) from public, anon;
grant execute on function public.can_see_expense(uuid) to authenticated;

revoke execute on function public.compute_expense_debts(uuid) from public, anon, authenticated;
revoke execute on function public.save_expense_people(uuid, uuid, bigint, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.is_settled_in_group(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.close_group(uuid) from public, anon, authenticated;
revoke execute on function public.after_group_member_left() from public, anon, authenticated;
revoke execute on function public.anonymize_deleted_user() from public, anon, authenticated;

revoke execute on function public.create_expense(text, bigint, text, jsonb, jsonb, uuid, text, date, text) from public, anon;
revoke execute on function public.update_expense(uuid, text, bigint, text, jsonb, jsonb, text, date, text) from public, anon;
revoke execute on function public.set_expense_deleted(uuid, boolean) from public, anon;
revoke execute on function public.list_my_balances() from public, anon;
revoke execute on function public.list_expenses(uuid, uuid) from public, anon;
grant execute on function public.create_expense(text, bigint, text, jsonb, jsonb, uuid, text, date, text) to authenticated;
grant execute on function public.update_expense(uuid, text, bigint, text, jsonb, jsonb, text, date, text) to authenticated;
grant execute on function public.set_expense_deleted(uuid, boolean) to authenticated;
grant execute on function public.list_my_balances() to authenticated;
grant execute on function public.list_expenses(uuid, uuid) to authenticated;
