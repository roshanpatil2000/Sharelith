-- Avatar and cover URLs must be Storage URLs. Run with: npx supabase test db
begin;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.co', '{"full_name":"A"}');

insert into public.groups (id, name, created_by) values
  ('00000000-0000-0000-0000-0000000000f1', 'Trip',
   '00000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$update public.profiles set avatar_url =
    'https://byinhavevmzabiihryja.supabase.co/storage/v1/object/public/avatars/00000000-0000-0000-0000-00000000000a/avatar.jpg?v=1763456789000'
    where id = '00000000-0000-0000-0000-00000000000a'$$,
  'a storage avatar URL is accepted'
);
select lives_ok(
  $$update public.profiles set avatar_url =
    'http://127.0.0.1:54321/storage/v1/object/public/avatars/00000000-0000-0000-0000-00000000000a/avatar.jpg'
    where id = '00000000-0000-0000-0000-00000000000a'$$,
  'a local storage avatar URL is accepted'
);
select lives_ok(
  $$update public.profiles set avatar_url = null
    where id = '00000000-0000-0000-0000-00000000000a'$$,
  'avatar_url can be cleared'
);
select throws_ok(
  $$update public.profiles set avatar_url = 'https://evil.example/pixel.png'
    where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'an outside avatar URL is rejected'
);
select throws_ok(
  $$update public.profiles set avatar_url =
    'https://byinhavevmzabiihryja.supabase.co/storage/v1/object/public/group-covers/x/cover.jpg'
    where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'an avatar URL from another bucket is rejected'
);

select lives_ok(
  $$update public.groups set cover_url =
    'https://byinhavevmzabiihryja.supabase.co/storage/v1/object/public/group-covers/00000000-0000-0000-0000-0000000000f1/cover.jpg?v=1763456789000'
    where id = '00000000-0000-0000-0000-0000000000f1'$$,
  'a storage cover URL is accepted'
);
select throws_ok(
  $$update public.groups set cover_url = 'https://evil.example/pixel.png'
    where id = '00000000-0000-0000-0000-0000000000f1'$$,
  '23514', null, 'an outside cover URL is rejected'
);
select throws_ok(
  $$update public.groups set cover_url =
    'http://evil.example/storage/v1/object/public/group-covers/x/cover.jpg'
    where id = '00000000-0000-0000-0000-0000000000f1'$$,
  '23514', null, 'a plain-http cover URL from a non-local host is rejected'
);

select * from finish();
rollback;
