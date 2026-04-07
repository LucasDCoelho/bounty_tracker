-- RLS policies for public.stores
-- Run this script in Supabase SQL Editor.

alter table public.stores enable row level security;

-- Optional cleanup
DROP POLICY IF EXISTS "stores_select_own" ON public.stores;
DROP POLICY IF EXISTS "stores_insert_own" ON public.stores;
DROP POLICY IF EXISTS "stores_update_own" ON public.stores;
DROP POLICY IF EXISTS "stores_delete_own" ON public.stores;

create policy "stores_select_own"
on public.stores
for select
to authenticated
using (owner_id = auth.uid());

create policy "stores_insert_own"
on public.stores
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "stores_update_own"
on public.stores
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "stores_delete_own"
on public.stores
for delete
to authenticated
using (owner_id = auth.uid());

-- RLS policies for public.tournaments (owner of related store)
alter table public.tournaments enable row level security;

DROP POLICY IF EXISTS "tournaments_select_own" ON public.tournaments;
DROP POLICY IF EXISTS "tournaments_insert_own_store" ON public.tournaments;
DROP POLICY IF EXISTS "tournaments_update_own_store" ON public.tournaments;
DROP POLICY IF EXISTS "tournaments_delete_own_store" ON public.tournaments;

create policy "tournaments_select_own"
on public.tournaments
for select
to authenticated
using (
	exists (
		select 1
		from public.stores s
		where s.id = tournaments.store_id
			and s.owner_id = auth.uid()
	)
);

create policy "tournaments_insert_own_store"
on public.tournaments
for insert
to authenticated
with check (
	exists (
		select 1
		from public.stores s
		where s.id = tournaments.store_id
			and s.owner_id = auth.uid()
	)
);

create policy "tournaments_update_own_store"
on public.tournaments
for update
to authenticated
using (
	exists (
		select 1
		from public.stores s
		where s.id = tournaments.store_id
			and s.owner_id = auth.uid()
	)
)
with check (
	exists (
		select 1
		from public.stores s
		where s.id = tournaments.store_id
			and s.owner_id = auth.uid()
	)
);

create policy "tournaments_delete_own_store"
on public.tournaments
for delete
to authenticated
using (
	exists (
		select 1
		from public.stores s
		where s.id = tournaments.store_id
			and s.owner_id = auth.uid()
	)
);

-- RLS policies for public.store_buylists (owner of related store)
alter table public.store_buylists enable row level security;

DROP POLICY IF EXISTS "store_buylists_select_own" ON public.store_buylists;
DROP POLICY IF EXISTS "store_buylists_insert_own_store" ON public.store_buylists;
DROP POLICY IF EXISTS "store_buylists_update_own_store" ON public.store_buylists;
DROP POLICY IF EXISTS "store_buylists_delete_own_store" ON public.store_buylists;

create policy "store_buylists_select_own"
on public.store_buylists
for select
to authenticated
using (
	exists (
		select 1
		from public.stores s
		where s.id = store_buylists.store_id
			and s.owner_id = auth.uid()
	)
);

create policy "store_buylists_insert_own_store"
on public.store_buylists
for insert
to authenticated
with check (
	exists (
		select 1
		from public.stores s
		where s.id = store_buylists.store_id
			and s.owner_id = auth.uid()
	)
);

create policy "store_buylists_update_own_store"
on public.store_buylists
for update
to authenticated
using (
	exists (
		select 1
		from public.stores s
		where s.id = store_buylists.store_id
			and s.owner_id = auth.uid()
	)
)
with check (
	exists (
		select 1
		from public.stores s
		where s.id = store_buylists.store_id
			and s.owner_id = auth.uid()
	)
);

create policy "store_buylists_delete_own_store"
on public.store_buylists
for delete
to authenticated
using (
	exists (
		select 1
		from public.stores s
		where s.id = store_buylists.store_id
			and s.owner_id = auth.uid()
	)
);
