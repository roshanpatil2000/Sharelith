-- When Supabase confirms an email (user opened a confirmation link, with
-- "Confirm email" on), mark the profile verified on the server too, so it
-- never depends on the app catching the link.
--
-- Fires only on UPDATE from null → confirmed. With "Confirm email" off,
-- Supabase sets email_confirmed_at on INSERT (no email was opened), which
-- this deliberately ignores.
create or replace function public.sync_email_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email_verified_at = coalesce(email_verified_at, new.email_confirmed_at)
  where id = new.id;
  return new;
end;
$$;

revoke execute on function public.sync_email_verified() from public, anon, authenticated;

drop trigger if exists on_auth_email_confirmed on auth.users;
create trigger on_auth_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.sync_email_verified();
