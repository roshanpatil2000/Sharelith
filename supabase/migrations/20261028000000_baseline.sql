-- Baseline shared by every later migration.

create extension if not exists pgcrypto with schema extensions;

-- Keeps `updated_at` current on any table that adds:
--   create trigger set_updated_at before update on <table>
--     for each row execute function public.set_updated_at();
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
