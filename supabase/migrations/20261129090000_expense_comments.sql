-- Comments on expenses and payments. Everyone who can see the expense can
-- read and add comments; you can delete your own.

create table public.expense_comments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index expense_comments_expense_idx on public.expense_comments (expense_id, created_at);

alter table public.expense_comments enable row level security;

create policy "People on the expense read comments"
  on public.expense_comments for select to authenticated
  using (public.can_see_expense(expense_id));

create policy "People on the expense add comments"
  on public.expense_comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_see_expense(expense_id));

create policy "Authors delete their comments"
  on public.expense_comments for delete to authenticated
  using (author_id = auth.uid());

revoke all on public.expense_comments from anon;
grant select, delete on public.expense_comments to authenticated;
grant insert (expense_id, author_id, body) on public.expense_comments to authenticated;

-- New comments show up live on an open expense.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.expense_comments;
  end if;
end;
$$;
