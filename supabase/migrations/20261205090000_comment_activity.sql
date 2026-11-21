-- Comments notify everyone else on the expense: each new comment is an
-- activity ("Asha commented on Dinner") with a short preview, shown in the
-- feed and sent as a push.

alter table public.activities add column note text check (char_length(note) <= 160);

alter table public.activities drop constraint activities_kind_check;
alter table public.activities add constraint activities_kind_check check (kind in (
  'expense_added', 'expense_updated', 'expense_deleted', 'expense_restored',
  'payment_added', 'payment_deleted', 'payment_restored',
  'group_created', 'member_added', 'member_left', 'member_removed',
  'reminder', 'member_joined', 'comment_added'
));

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
    or kind in ('group_created', 'comment_added')
    or (kind in ('member_added', 'member_removed') and subject = recipient)
  );
$$;

create or replace function public.log_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  aid bigint;
begin
  insert into public.activities (
    kind, actor_id, group_id, expense_id, group_name, description,
    amount_minor, currency, note
  )
  select 'comment_added', new.author_id, e.group_id, e.id, g.name, e.description,
         e.amount_minor, e.currency,
         case when char_length(new.body) > 140
              then left(new.body, 139) || '…' else new.body end
  from public.expenses e
  left join public.groups g on g.id = e.group_id
  where e.id = new.expense_id
  returning id into aid;

  insert into public.activity_recipients (activity_id, user_id, net_minor)
  select aid, p.id, 0
  from unnest(public.expense_people(new.expense_id)) as p (id)
  where p.id is not null;
  return null;
end;
$$;

revoke execute on function public.log_comment_activity() from public, anon, authenticated;

create trigger log_comment_activity
  after insert on public.expense_comments
  for each row execute function public.log_comment_activity();

drop function public.list_activity(bigint, integer);

create function public.list_activity(
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
  payee_name text,
  note text
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
    owe.user_id, payee.full_name,
    a.note
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

revoke execute on function public.list_activity(bigint, integer) from public, anon;
grant execute on function public.list_activity(bigint, integer) to authenticated;
