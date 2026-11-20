-- Sharelith Pro. A person is Pro while a Google Play subscription is active
-- (or in its grace period), or while pro_override is on (test accounts and
-- complimentary Pro). Only the server writes either: the verify-purchase and
-- play-notifications edge functions (service role), or an admin.

create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  product_id text not null,
  purchase_token text not null unique,
  status text not null check (status in ('active', 'grace', 'on_hold', 'paused', 'expired', 'canceled')),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

create policy "People read their own subscription"
  on public.subscriptions for select to authenticated
  using (user_id = auth.uid());

alter table public.profiles
  add column pro_override boolean not null default false;

comment on column public.profiles.pro_override is
  'Pro without a subscription: test accounts and complimentary Pro. Set by an admin only.';

-- Whether someone has Pro right now.
create or replace function public.is_pro(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.pro_override from public.profiles p where p.id = uid), false)
    or exists (
      select 1 from public.subscriptions s
      where s.user_id = uid
        and s.status in ('active', 'grace', 'canceled')
        and s.expires_at > now()
    );
$$;

revoke execute on function public.is_pro(uuid) from public, anon, authenticated;
-- The purchase edge functions (service role) check it after saving.
grant execute on function public.is_pro(uuid) to service_role;

-- Your own Pro status, for the app.
create or replace function public.my_pro_status()
returns table (is_pro boolean, product_id text, status text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_pro(auth.uid()), s.product_id, s.status, s.expires_at
  from (select auth.uid() as uid) me
  left join public.subscriptions s on s.user_id = me.uid
  where me.uid is not null;
$$;

revoke execute on function public.my_pro_status() from public, anon;
grant execute on function public.my_pro_status() to authenticated;

-- For Pro-only RPCs and storage policies: fails unless the caller has Pro.
create or replace function public.require_pro()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_pro(auth.uid()) then
    raise exception 'This needs Sharelith Pro'
      using errcode = '42501', hint = 'pro_required';
  end if;
end;
$$;

revoke execute on function public.require_pro() from public, anon;
grant execute on function public.require_pro() to authenticated;
