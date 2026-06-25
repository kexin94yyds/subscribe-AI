create table if not exists public.monoexpire_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('subscription', 'reminder', 'goal')),
  item_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text,
  primary key (user_id, item_type, item_id)
);

alter table public.monoexpire_items enable row level security;

create policy "monoexpire_items_select_own"
on public.monoexpire_items
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "monoexpire_items_insert_own"
on public.monoexpire_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "monoexpire_items_update_own"
on public.monoexpire_items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "monoexpire_items_delete_own"
on public.monoexpire_items
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.monoexpire_items to authenticated;
