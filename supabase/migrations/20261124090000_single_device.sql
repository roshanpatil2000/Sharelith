-- One signed-in device per account. After a sign-in, the claim-session edge
-- function ends every other session of that user (their refresh tokens go
-- with them), so the old device is signed out on its next check.

create or replace function public.end_other_sessions(uid uuid, keep uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ended integer;
begin
  delete from auth.sessions s where s.user_id = uid and s.id <> keep;
  get diagnostics ended = row_count;
  return ended;
end;
$$;

-- Only the edge function (service role) may call it.
revoke execute on function public.end_other_sessions(uuid, uuid) from public, anon, authenticated;
grant execute on function public.end_other_sessions(uuid, uuid) to service_role;
