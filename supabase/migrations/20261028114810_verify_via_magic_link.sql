-- Email verification can also come from tapping the emailed link, whose
-- session records "magiclink" (not "otp") in the JWT amr claim.
create or replace function public.mark_email_verified()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as m
    where m ->> 'method' in ('otp', 'magiclink')
  ) then
    raise exception 'Email must be verified with a one-time code'
      using errcode = 'P0001';
  end if;

  update public.profiles
  set email_verified_at = coalesce(email_verified_at, now())
  where id = auth.uid();
end;
$$;
