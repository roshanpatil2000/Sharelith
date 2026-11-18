-- Payment reminders: nudge a friend who owes you. It shows in both feeds and
-- pushes to the friend. Once a day per friend, so it can't be used to spam.

alter table public.activities drop constraint activities_kind_check;
alter table public.activities add constraint activities_kind_check check (kind in (
  'expense_added', 'expense_updated', 'expense_deleted', 'expense_restored',
  'payment_added', 'payment_deleted', 'payment_restored',
  'group_created', 'member_added', 'member_left', 'member_removed',
  'reminder'
));

-- Reminds friend of what they owe you overall, in the currency they owe the
-- most. Fails if they owe you nothing or you reminded them in the last day.
create or replace function public.send_reminder(friend uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  owed bigint;
  cur text;
  aid bigint;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.friendships f
    where (f.user_a, f.user_b) = (least(me, friend), greatest(me, friend))
  ) then
    raise exception 'You can only remind friends'
      using errcode = '42501', hint = 'not_friends';
  end if;

  select b.currency, sum(b.net_minor)::bigint into cur, owed
  from public.list_my_balances() b
  where b.friend_id = friend
  group by b.currency
  having sum(b.net_minor) > 0
  order by 2 desc
  limit 1;
  if owed is null then
    raise exception 'They don’t owe you anything'
      using errcode = 'P0001', hint = 'not_owed';
  end if;

  if exists (
    select 1 from public.activities a
    where a.kind = 'reminder' and a.actor_id = me and a.subject_id = friend
      and a.created_at > now() - interval '1 day'
  ) then
    raise exception 'You already reminded them today'
      using errcode = 'P0001', hint = 'reminded';
  end if;

  insert into public.activities (kind, actor_id, subject_id, amount_minor, currency)
  values ('reminder', me, friend, owed, cur)
  returning id into aid;
  -- Both feeds show it; only the friend gets a push.
  insert into public.activity_recipients (activity_id, user_id)
  values (aid, me), (aid, friend);
end;
$$;

revoke execute on function public.send_reminder(uuid) from public, anon;
grant execute on function public.send_reminder(uuid) to authenticated;

create or replace function public.should_push(
  kind text,
  actor uuid,
  subject uuid,
  recipient uuid,
  net bigint
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select recipient is distinct from actor and (
    net <> 0
    or kind = 'group_created'
    or (kind in ('member_added', 'member_removed', 'reminder') and subject = recipient)
  );
$$;
