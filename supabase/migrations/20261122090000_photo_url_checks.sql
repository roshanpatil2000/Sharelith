-- Photo URLs must point at this project's own Storage buckets, so a user
-- can't make other people's devices load an arbitrary (tracking) image.
-- The host isn't pinned (local/CI databases use other hosts); the path must be
-- the public object path of the right bucket, optionally with the app's
-- ?v=<timestamp> cache-buster. http is allowed only for local hosts.

create function public.is_storage_photo_url(url text, bucket text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select url ~ (
    '^(https://[A-Za-z0-9.-]+(:[0-9]+)?|http://(127\.0\.0\.1|localhost|10\.0\.2\.2)(:[0-9]+)?)'
    || '/storage/v1/object/public/' || bucket
    || '/[A-Za-z0-9_-]+(/[A-Za-z0-9_.-]+)*(\?v=[0-9]+)?$'
  ) and url !~ '/\.\.?(/|\?|$)';
$$;

update public.profiles set avatar_url = null
where avatar_url is not null
  and not public.is_storage_photo_url(avatar_url, 'avatars');

update public.groups set cover_url = null
where cover_url is not null
  and not public.is_storage_photo_url(cover_url, 'group-covers');

alter table public.profiles
  add constraint profiles_avatar_url_storage
  check (avatar_url is null or public.is_storage_photo_url(avatar_url, 'avatars'));

alter table public.groups
  add constraint groups_cover_url_storage
  check (cover_url is null or public.is_storage_photo_url(cover_url, 'group-covers'));
