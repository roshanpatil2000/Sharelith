-- Push notifications. Each device registers its FCM token. When an activity
-- reaches someone and it's about them (it changes their balance, or they were
-- added to or removed from a group), the send-push edge function is called
-- for that person.
--
-- The function's URL and shared secret live in Vault, under push_function_url
-- and push_webhook_secret. Without them nothing is sent, so local and CI
-- databases never call out.

create extension if not exists pg_net with schema extensions;

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

-- Only the RPCs below and the service role touch tokens.
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

-- Saves this device's token for you. A token moves to whoever signed in last.
create or replace function public.register_push_token(token text, platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if length(coalesce(token, '')) not between 1 and 4096 then
    raise exception 'Invalid token' using errcode = '22023';
  end if;
  insert into public.push_tokens (token, user_id, platform)
  values (register_push_token.token, auth.uid(), register_push_token.platform)
  on conflict on constraint push_tokens_pkey do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$$;

-- Stops pushes to this device, before signing out.
create or replace function public.unregister_push_token(token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens t
  where t.token = unregister_push_token.token and t.user_id = auth.uid();
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Whether an activity row is worth a push for its recipient: not their own
-- action, and either it moves their balance or it's their own membership.
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
    or (kind in ('member_added', 'member_removed') and subject = recipient)
  );
$$;

create or replace function public.push_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.activities;
  fn_url text;
  fn_secret text;
begin
  select * into a from public.activities where id = new.activity_id;
  if not public.should_push(a.kind, a.actor_id, a.subject_id, new.user_id, new.net_minor) then
    return null;
  end if;
  if not exists (select 1 from public.push_tokens where user_id = new.user_id) then
    return null;
  end if;

  select decrypted_secret into fn_url
  from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into fn_secret
  from vault.decrypted_secrets where name = 'push_webhook_secret';
  if fn_url is null or fn_secret is null then
    return null;
  end if;

  perform net.http_post(
    url := fn_url,
    body := jsonb_build_object(
      'activity_id', new.activity_id,
      'user_id', new.user_id,
      'net_minor', new.net_minor
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', fn_secret
    )
  );
  return null;
exception when others then
  -- A push is never worth failing the expense or payment over.
  raise warning 'push_activity: %', sqlerrm;
  return null;
end;
$$;

revoke execute on function public.push_activity() from public, anon, authenticated;

create trigger push_activity
  after insert on public.activity_recipients
  for each row execute function public.push_activity();
