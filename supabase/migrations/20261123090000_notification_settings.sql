-- Notification settings: each person picks which kinds of push they get.
-- Activity still shows in the feed either way; this only stops the push.

alter table public.profiles
  add column notify_expenses boolean not null default true,
  add column notify_payments boolean not null default true,
  add column notify_groups boolean not null default true,
  add column notify_reminders boolean not null default true;

grant update (notify_expenses, notify_payments, notify_groups, notify_reminders)
  on public.profiles to authenticated;

-- Whether the recipient has this kind of push switched on.
create or replace function public.push_allowed(kind text, recipient uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select case
      when kind like 'expense_%' then p.notify_expenses
      when kind like 'payment_%' then p.notify_payments
      when kind in ('group_created', 'member_added', 'member_removed') then p.notify_groups
      when kind = 'reminder' then p.notify_reminders
      else true
    end
    from public.profiles p where p.id = recipient
  ), true);
$$;

revoke execute on function public.push_allowed(text, uuid) from public, anon, authenticated;

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
  if not public.push_allowed(a.kind, new.user_id) then
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
