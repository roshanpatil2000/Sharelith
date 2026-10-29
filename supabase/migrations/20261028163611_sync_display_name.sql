-- profiles.full_name is the source of truth. Mirror it into the auth user's
-- metadata so the dashboard's "Display name" (Authentication → Users) and
-- auth emails stay in sync, whether the name changes in the app or the
-- Table Editor.
create or replace function public.sync_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
  set raw_user_meta_data =
    coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('full_name', new.full_name, 'display_name', new.full_name)
  where id = new.id;
  return new;
end;
$$;

revoke execute on function public.sync_display_name() from public, anon, authenticated;

create trigger sync_display_name
  after update of full_name on public.profiles
  for each row
  when (old.full_name is distinct from new.full_name)
  execute function public.sync_display_name();

-- Backfill accounts whose names were edited before this trigger existed.
update auth.users u
set raw_user_meta_data =
  coalesce(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('full_name', p.full_name, 'display_name', p.full_name)
from public.profiles p
where p.id = u.id
  and coalesce(u.raw_user_meta_data ->> 'full_name', '') <> p.full_name;
