-- Slice 128 — Cash Buyers CRM (cash_buyers table).
--
-- The platform had no cash buyers table or CRM before this slice.
-- One row per buyer per wholesaler: contact facts the wholesaler
-- entered themselves, the buy box they stated, and the wholesaler's
-- own attestation that they verified proof of funds (pof_verified
-- is the wholesaler's claim, never platform verification).
--
-- Sealed Office RLS: a wholesaler reads/writes only their own
-- buyers; the operator reads all (support and oversight only).
-- Policies are dropped before creation so the file re-runs cleanly
-- (the Slice 122 ordering lesson). The updated_at trigger reuses
-- public.set_updated_at() from Slice 124 — no second function.
-- UNIQUE(user_id, email) so the same buyer cannot be added twice.
-- No policy or function here references a table created later in
-- this file. Nothing in this migration sends email or messages:
-- the deal blast is a copy/mailto convenience in the app only.

create table if not exists public.cash_buyers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  name text not null,
  company text,
  email text not null,
  phone text,
  -- Buy box, as the buyer stated it. All optional: a buyer with no
  -- stated box still gets listed, with blanks — never invented.
  target_counties text[] not null default '{}',
  max_budget numeric,
  min_beds integer,
  property_types text[] not null default '{}',
  -- The wholesaler's own attestation ("I verified proof of
  -- funds"). This is NOT platform verification.
  pof_verified boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_buyers_user_email_unique unique (user_id, email)
);

alter table public.cash_buyers enable row level security;

create index if not exists idx_cash_buyers_user
  on public.cash_buyers (user_id);
create index if not exists idx_cash_buyers_user_county
  on public.cash_buyers (user_id, target_counties);

drop trigger if exists cash_buyers_set_updated_at on public.cash_buyers;
create trigger cash_buyers_set_updated_at
  before update on public.cash_buyers
  for each row execute function public.set_updated_at();

-- Owner policies (four, one per operation).
drop policy if exists "wholesaler reads own cash buyers" on public.cash_buyers;
create policy "wholesaler reads own cash buyers"
  on public.cash_buyers
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "wholesaler inserts own cash buyers" on public.cash_buyers;
create policy "wholesaler inserts own cash buyers"
  on public.cash_buyers
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "wholesaler updates own cash buyers" on public.cash_buyers;
create policy "wholesaler updates own cash buyers"
  on public.cash_buyers
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "wholesaler deletes own cash buyers" on public.cash_buyers;
create policy "wholesaler deletes own cash buyers"
  on public.cash_buyers
  for delete
  to authenticated
  using (user_id = auth.uid());

-- The operator reads every wholesaler's cash buyers (support and
-- oversight only — the operator never edits another office's rows).
drop policy if exists "operator reads all cash buyers" on public.cash_buyers;
create policy "operator reads all cash buyers"
  on public.cash_buyers
  for select
  to authenticated
  using (public.is_operator());

-- Rollback (only if this migration itself must be undone):
--   drop table if exists public.cash_buyers;
