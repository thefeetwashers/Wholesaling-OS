-- Slice 133 — saved searches for buyers (buyer_saved_searches).
--
-- A signed-in buyer saves the search criteria they filter the
-- public Cash Buyers directory (/buyers) by — states, markets
-- (counties), property types, price range — and applies or
-- deletes them later (lib/saved-searches.ts). The criteria mirror
-- the /buyers filters exactly, so applying a search is just
-- restoring filter state.
--
-- Matching deals show IN THE APP ONLY: /vip already shows
-- matching published deals in the app. NO email alerts — no
-- email provider is connected, so no email/SMS trigger lives
-- here and none is claimed. Money fields are numeric or NULL —
-- never defaulted.
--
-- Access: owner-only CRUD (user_id = auth.uid()) + operator
-- read via public.is_operator() (support and oversight only).
-- No anon access: a saved search belongs to a signed-in buyer.
-- public.is_operator() and public.set_updated_at() already exist
-- (migration 20261115090000); no function is created here.
--
-- No policy or function here references a table created later in
-- this file. Nothing here sends email or messages.

create table if not exists public.buyer_saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Optional display name; when blank the app labels the search
  -- from its criteria (lib/saved-searches.ts savedSearchLabel).
  name text not null default '',
  states text[] not null default '{}',
  markets text[] not null default '{}',
  property_types text[] not null default '{}',
  min_price numeric,
  max_price numeric,
  created_at timestamptz not null default now()
);

alter table public.buyer_saved_searches enable row level security;

create index if not exists idx_buyer_saved_searches_user
  on public.buyer_saved_searches (user_id);
create index if not exists idx_buyer_saved_searches_user_created
  on public.buyer_saved_searches (user_id, created_at desc);

-- Owner policies (four, one per operation).
drop policy if exists "owner reads own saved searches" on public.buyer_saved_searches;
create policy "owner reads own saved searches"
  on public.buyer_saved_searches
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "owner inserts own saved search" on public.buyer_saved_searches;
create policy "owner inserts own saved search"
  on public.buyer_saved_searches
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "owner updates own saved search" on public.buyer_saved_searches;
create policy "owner updates own saved search"
  on public.buyer_saved_searches
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "owner deletes own saved search" on public.buyer_saved_searches;
create policy "owner deletes own saved search"
  on public.buyer_saved_searches
  for delete
  to authenticated
  using (user_id = auth.uid());

-- The operator reads every saved search (support and oversight only).
drop policy if exists "operator reads all saved searches" on public.buyer_saved_searches;
create policy "operator reads all saved searches"
  on public.buyer_saved_searches
  for select
  to authenticated
  using (public.is_operator());

-- Grants (see other Slice 132/133 migrations — without these the
-- app cannot touch the table at all, RLS policies
-- notwithstanding). Authenticated + service_role only; NO anon
-- grant — saved searches are never public.
grant select, insert, update, delete on public.buyer_saved_searches to authenticated;
grant select, insert, update, delete on public.buyer_saved_searches to service_role;

-- Rollback (only if this migration itself must be undone):
--   drop table if exists public.buyer_saved_searches;
