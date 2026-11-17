-- Marks accounts used for testing, so they can be told apart from real users
-- (and later left out of anything counted or contacted). Set by an admin in
-- the dashboard or SQL editor; users can't set or see it on other profiles.
alter table public.profiles
  add column is_test_user boolean not null default false;

comment on column public.profiles.is_test_user is
  'Account used for testing. Set by an admin only.';
