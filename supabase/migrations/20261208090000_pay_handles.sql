-- Where people can be paid: a UPI ID and a PayPal.me username. Private
-- columns, like phone: friends and group members read them only through
-- get_pay_handles(), and only to pay that person.

alter table public.profiles
  add column upi_id text
    check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$'),
  add column paypal_username text
    check (paypal_username is null or paypal_username ~ '^[A-Za-z0-9]{1,20}$');

grant update (upi_id, paypal_username) on public.profiles to authenticated;

-- You, a friend, or someone in a group you're both still in.
create or replace function public.get_pay_handles(uid uuid)
returns table (upi_id text, paypal_username text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.upi_id, p.paypal_username
  from public.profiles p
  where p.id = uid
    and (
      uid = auth.uid()
      or exists (
        select 1 from public.friendships f
        where f.user_a = least(auth.uid(), uid)
          and f.user_b = greatest(auth.uid(), uid)
      )
      or exists (
        select 1
        from public.group_members a
        join public.group_members b on b.group_id = a.group_id
        where a.user_id = auth.uid() and a.left_at is null
          and b.user_id = uid and b.left_at is null
      )
    );
$$;

revoke execute on function public.get_pay_handles(uuid) from public, anon;
grant execute on function public.get_pay_handles(uuid) to authenticated;
