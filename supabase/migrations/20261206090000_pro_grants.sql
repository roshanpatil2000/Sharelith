-- Pro comes from two places:
--   subscriptions     paid on Google Play
--   pro_grants        given by an admin, with a reason and history
-- admin_pro_status shows who has Pro and why, and is the one place the rule
-- lives. This replaces the profiles.pro_override flag.

create table public.pro_grants (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('test', 'complimentary', 'support')),
  note text,
  granted_at timestamptz not null default now(),
  expires_at timestamptz check (expires_at > granted_at),
  revoked_at timestamptz,
  revoke_note text
);

comment on table public.pro_grants is
  'Pro given by an admin, one row each time. Use grant_pro() and revoke_pro(); see admin_pro_status for who has Pro now.';
comment on column public.pro_grants.expires_at is 'When it ends. Empty means until revoked.';
comment on column public.pro_grants.revoked_at is 'When it was turned off. Empty means not revoked.';

create index pro_grants_user_idx on public.pro_grants (user_id);
create unique index pro_grants_one_open_idx
  on public.pro_grants (user_id) where revoked_at is null;

alter table public.pro_grants enable row level security;
revoke all on public.pro_grants from anon, authenticated, service_role;

create view public.admin_pro_status
with (security_invoker = true)
as
select
  p.id as user_id,
  p.email,
  live.by_subscription or live.by_grant as is_pro,
  case
    when live.by_subscription and live.by_grant then 'subscription+grant'
    when live.by_subscription then 'subscription'
    when live.by_grant then 'grant'
    else 'free'
  end as source,
  live.by_subscription as subscription_active,
  g.reason as grant_reason,
  g.note as grant_note,
  g.expires_at as grant_until,
  s.status as subscription_status,
  s.expires_at as subscription_until
from public.profiles p
left join public.pro_grants g on g.user_id = p.id and g.revoked_at is null
left join public.subscriptions s on s.user_id = p.id
cross join lateral (
  select
    coalesce(s.status in ('active', 'grace', 'canceled') and s.expires_at > now(), false)
      as by_subscription,
    g.id is not null and (g.expires_at is null or g.expires_at > now())
      as by_grant
) live
where p.deleted_at is null;

comment on view public.admin_pro_status is
  'Who has Pro and why. Admins only: it lists emails.';

revoke all on public.admin_pro_status from anon, authenticated, service_role;

-- Carry the old flag over, and refuse to go on if that changes anyone's Pro.
-- is_pro() still follows the old rule until it's replaced below.
do $$
begin
  insert into public.pro_grants (user_id, reason, note)
  select p.id,
         case when p.is_test_user then 'test' else 'complimentary' end,
         'Moved from pro_override; original date unknown'
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.pro_override and p.deleted_at is null;

  if exists (
    select 1 from public.admin_pro_status v
    where v.is_pro is distinct from public.is_pro(v.user_id)
  ) then
    raise exception 'Moving pro_override to pro_grants would change who has Pro';
  end if;
end;
$$;

create or replace function public.is_pro(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select v.is_pro from public.admin_pro_status v where v.user_id = uid), false);
$$;

-- The subscription fields are filled only while that subscription gives Pro,
-- so an expired one can't show "Renews on" a past date next to granted Pro.
create or replace function public.my_pro_status()
returns table (is_pro boolean, product_id text, status text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(v.is_pro, false), s.product_id, s.status, s.expires_at
  from (select auth.uid() as uid) me
  left join public.admin_pro_status v on v.user_id = me.uid
  left join public.subscriptions s on s.user_id = v.user_id and v.subscription_active
  where me.uid is not null;
$$;

-- For the SQL editor:
--   select public.grant_pro('person@example.com', 'complimentary');
create function public.grant_pro(
  email text,
  reason text,
  note text default null,
  ends_at timestamptz default null
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  account uuid;
  made bigint;
begin
  select u.id into account
  from auth.users u
  where lower(u.email) = lower(trim(grant_pro.email));
  if account is null then
    raise exception 'No account has the email %', grant_pro.email;
  end if;
  if grant_pro.ends_at <= now() then
    raise exception 'The end date must be in the future';
  end if;

  update public.pro_grants g
  set revoked_at = now(), revoke_note = 'replaced'
  where g.user_id = account and g.revoked_at is null;

  insert into public.pro_grants (user_id, reason, note, expires_at)
  values (account, grant_pro.reason, grant_pro.note, grant_pro.ends_at)
  returning pro_grants.id into made;
  return made;
end;
$$;

-- Ends granted Pro. A paid subscription is left alone.
create function public.revoke_pro(email text, note text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  account uuid;
begin
  select u.id into account
  from auth.users u
  where lower(u.email) = lower(trim(revoke_pro.email));
  if account is null then
    raise exception 'No account has the email %', revoke_pro.email;
  end if;

  update public.pro_grants g
  set revoked_at = now(), revoke_note = revoke_pro.note
  where g.user_id = account and g.revoked_at is null;
  if not found then
    raise exception '% has no Pro grant to revoke', revoke_pro.email;
  end if;
end;
$$;

revoke execute on function public.grant_pro(text, text, text, timestamptz)
  from public, anon, authenticated, service_role;
revoke execute on function public.revoke_pro(text, text)
  from public, anon, authenticated, service_role;

alter table public.profiles drop column pro_override;
