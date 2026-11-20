-- Receipt photos (Sharelith Pro). One photo per expense, in the private
-- "receipts" bucket at <expense_id>/<file>. Everyone on the expense can see
-- it; only people on the expense who have Pro can add, replace or remove it.

alter table public.expenses
  add column receipt_path text check (receipt_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- The expense a receipt file belongs to, or null if the path isn't ours.
create or replace function public.receipt_expense(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  folder text := (storage.foldername(object_name))[1];
begin
  if folder is null or folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return folder::uuid;
end;
$$;

create or replace function public.can_read_receipt(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.can_see_expense(public.receipt_expense(object_name)), false);
$$;

create or replace function public.can_write_receipt(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and public.is_pro(auth.uid())
    and coalesce(public.can_see_expense(public.receipt_expense(object_name)), false)
    and not exists (
      select 1 from public.expenses e
      where e.id = public.receipt_expense(object_name) and (e.is_payment or e.deleted_at is not null)
    );
$$;

revoke execute on function public.can_read_receipt(text) from public, anon;
revoke execute on function public.can_write_receipt(text) from public, anon;
grant execute on function public.can_read_receipt(text) to authenticated;
grant execute on function public.can_write_receipt(text) to authenticated;

create policy "People on an expense can see its receipt"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.can_read_receipt(name));

create policy "Pro members can add a receipt"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.can_write_receipt(name));

create policy "Pro members can replace a receipt"
  on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and public.can_write_receipt(name))
  with check (bucket_id = 'receipts' and public.can_write_receipt(name));

create policy "Pro members can remove a receipt"
  on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.can_write_receipt(name));

-- Attaches (or with null, detaches) the receipt photo on an expense.
create or replace function public.set_expense_receipt(eid uuid, path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_pro();
  if not public.can_see_expense(eid) then
    raise exception 'Expense not found' using errcode = '42501', hint = 'not_found';
  end if;
  if path is not null and public.receipt_expense(path) is distinct from eid then
    raise exception 'That photo belongs to another expense' using errcode = '22023', hint = 'wrong_expense';
  end if;
  update public.expenses
  set receipt_path = path
  where id = eid and deleted_at is null and not is_payment;
  if not found then
    raise exception 'Receipts can only be added to expenses' using errcode = 'P0001', hint = 'not_expense';
  end if;
end;
$$;

revoke execute on function public.set_expense_receipt(uuid, text) from public, anon;
grant execute on function public.set_expense_receipt(uuid, text) to authenticated;
