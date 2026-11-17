-- Slice 131 — Buyer Networks: the wholesaler's own buy box.
--
-- One row per wholesaler: the buying criteria THEY state (markets,
-- property types, price range, notes), so it can be copied into
-- OpenBuyersList — a free network where cash buyers publish their
-- buy box and wholesalers send off-market deals to matching buyers.
--
-- This table holds ONLY the signed-in wholesaler's own criteria.
-- No buyer names, emails, phones, companies, or counts from
-- OpenBuyersList (or anywhere else) are copied, seeded, or stored
-- here: those buyers never consented to be in this platform, their
-- contact details are private by design on OpenBuyersList, and
-- there is no public API or feed to pull from. The app links out
-- to OpenBuyersList (components/BuyerNetworks.tsx) and the
-- wholesaler browses and connects there.
--
-- Sealed Office RLS: a wholesaler reads/writes only their own buy
-- box; the operator reads all (support and oversight only).
-- Policies are dropped before creation so the file re-runs cleanly.
-- The updated_at trigger reuses public.set_updated_at() from
-- Slice 124 — no second function. UNIQUE(user_id): one buy box
-- per wholesaler, saved by upsert on user_id.
--
-- GRANTS ARE IN THIS FILE (the Nov 17 lesson): tables created by
-- migrations get NO data grants by default — only the original
-- `leads` table has SELECT/INSERT/UPDATE/DELETE for the
-- authenticated role. Without the grants below, the app gets
-- "permission denied for table wholesaler_buy_boxes" and the
-- feature silently does nothing, exactly as probate_leads did on
-- Nov 17, 2026 before migration 20261117123500 fixed it. The RLS
-- policies remain the real gate.
--
-- No policy or function here references a table created later in
-- this file. Nothing here sends email or messages.

create table if not exists public.wholesaler_buy_boxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The wholesaler's own buying criteria. All optional: an empty
  -- buy box is saved as empty — never pre-filled or invented.
  markets text[] not null default '{}',
  property_types text[] not null default '{}',
  min_price numeric,
  max_price numeric,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wholesaler_buy_boxes_user_unique unique (user_id)
);

alter table public.wholesaler_buy_boxes enable row level security;

create index if not exists idx_wholesaler_buy_boxes_user
  on public.wholesaler_buy_boxes (user_id);

drop trigger if exists wholesaler_buy_boxes_set_updated_at on public.wholesaler_buy_boxes;
create trigger wholesaler_buy_boxes_set_updated_at
  before update on public.wholesaler_buy_boxes
  for each row execute function public.set_updated_at();

-- Owner policies (four, one per operation).
drop policy if exists "wholesaler reads own buy box" on public.wholesaler_buy_boxes;
create policy "wholesaler reads own buy box"
  on public.wholesaler_buy_boxes
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "wholesaler inserts own buy box" on public.wholesaler_buy_boxes;
create policy "wholesaler inserts own buy box"
  on public.wholesaler_buy_boxes
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "wholesaler updates own buy box" on public.wholesaler_buy_boxes;
create policy "wholesaler updates own buy box"
  on public.wholesaler_buy_boxes
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "wholesaler deletes own buy box" on public.wholesaler_buy_boxes;
create policy "wholesaler deletes own buy box"
  on public.wholesaler_buy_boxes
  for delete
  to authenticated
  using (user_id = auth.uid());

-- The operator reads every wholesaler's buy box (support and
-- oversight only — the operator never edits another office's rows).
drop policy if exists "operator reads all buy boxes" on public.wholesaler_buy_boxes;
create policy "operator reads all buy boxes"
  on public.wholesaler_buy_boxes
  for select
  to authenticated
  using (public.is_operator());

-- Grants (see header — without these the app cannot touch the table
-- at all, RLS policies notwithstanding).
grant select, insert, update, delete on public.wholesaler_buy_boxes to authenticated;
grant select, insert, update, delete on public.wholesaler_buy_boxes to service_role;

-- Rollback (only if this migration itself must be undone):
--   drop table if exists public.wholesaler_buy_boxes;
