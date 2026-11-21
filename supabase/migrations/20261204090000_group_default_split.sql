-- A group's default split: new expenses in it start split this way instead of
-- equally. Stored as {"type": "percent" | "shares", "values": {user_id: n}};
-- null means equal. Any member can set it.

alter table public.groups add column default_split jsonb;

create or replace function public.set_group_default_split(gid uuid, split jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  kind text;
  total numeric := 0;
  person text;
  amount numeric;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.is_group_member(gid) then
    raise exception 'You’re not in this group' using errcode = '42501', hint = 'not_member';
  end if;

  if split is not null then
    kind := split ->> 'type';
    if kind not in ('percent', 'shares') or jsonb_typeof(split -> 'values') <> 'object' then
      raise exception 'Choose percentages or shares' using errcode = '22023';
    end if;
    for person, amount in
      select key, (value #>> '{}')::numeric from jsonb_each(split -> 'values')
    loop
      if amount < 0 then
        raise exception 'Use numbers of 0 or more' using errcode = '22023';
      end if;
      if not exists (
        select 1 from public.group_members m
        where m.group_id = gid and m.user_id = person::uuid and m.left_at is null
      ) then
        raise exception 'Everyone in the split must be in the group' using errcode = '22023';
      end if;
      total := total + amount;
    end loop;
    if kind = 'percent' and total <> 100 then
      raise exception 'Percentages must add up to 100' using errcode = '22023';
    end if;
    if total <= 0 then
      raise exception 'Give at least one person a share' using errcode = '22023';
    end if;
    -- Keep only the two keys.
    split := jsonb_build_object('type', kind, 'values', split -> 'values');
  end if;

  update public.groups set default_split = split, updated_at = now() where id = gid;
end;
$$;

revoke execute on function public.set_group_default_split(uuid, jsonb) from public, anon;
grant execute on function public.set_group_default_split(uuid, jsonb) to authenticated;
