-- Slice 133 — Buyer offers on a published deal.
--
-- Table:
--   public.deal_offers — a signed-in buyer's real offer on one
--     published deal: offer price, earnest-money amount, closing
--     date. Status runs pending -> accepted / declined /
--     withdrawn. An offer is NOT a response: deal_responses stays
--     the free-text message + mutual-opt-in contact flow from
--     Slice 132, and is NOT extended — bolting money columns onto
--     every message row would conflate "responded" with "offered",
--     and one buyer may both respond to a deal and offer on it.
--     A separate table keeps the two flows, their lifecycles, and
--     their RLS apart, with no duplicate table.
--
-- RLS + GRANTS ARE IN THIS FILE (the Nov 17 lesson): tables
-- created by migrations get NO data grants by default, so without
-- the grants below the app gets "permission denied" and the
-- feature silently does nothing. The RLS policies remain the real
-- gate. Policies are dropped before creation so the file re-runs
-- cleanly. The updated_at trigger reuses public.set_updated_at()
-- from Slice 122 — no second function. No policy or function here
-- references a table created later in this file:
-- public.published_deals is from Slice 132, public.is_operator()
-- and public.set_updated_at() already exist.
--
-- Visibility: an offer is visible ONLY to the offering buyer, the
-- deal owner, and the operator. No anon access of any kind — no
-- anon SELECT, INSERT, UPDATE, or DELETE. Status values are
-- enforced app-side by role (lib/deal-offers.ts: only the deal
-- owner calls accept/decline, only the offering buyer calls
-- withdraw), the same precedent as the Slice 132 contact-share
-- flags, which RLS also gates by row, not by value.
--
-- No fake data is seeded. Money is never pre-filled anywhere in
-- the app; the offer form starts empty.

create table if not exists public.deal_offers (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.published_deals (id) on delete cascade,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  -- The offered price. Required and positive: an offer with no
  -- price is not an offer. No default — the buyer types it.
  offer_price numeric not null check (offer_price > 0),
  -- Earnest money the buyer offers. Optional; never pre-filled.
  emd_amount numeric check (emd_amount is null or emd_amount >= 0),
  -- Target closing date the buyer offers. Optional.
  closing_date date,
  -- pending -> accepted / declined / withdrawn. Terminal states
  -- are not moved by the app; accepting one offer does not
  -- auto-decline the others — the owner declines each one.
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deal_offers enable row level security;

create index if not exists idx_deal_offers_deal
  on public.deal_offers (deal_id);
create index if not exists idx_deal_offers_buyer
  on public.deal_offers (buyer_id);
create index if not exists idx_deal_offers_deal_status
  on public.deal_offers (deal_id, status);

drop trigger if exists deal_offers_set_updated_at on public.deal_offers;
create trigger deal_offers_set_updated_at
  before update on public.deal_offers
  for each row execute function public.set_updated_at();

-- A signed-in buyer submits an offer on a deal. One row per
-- offer; a buyer may submit more than one (a revised offer is a
-- new row — the app never overwrites the earlier one).
drop policy if exists "buyer inserts own deal offer" on public.deal_offers;
create policy "buyer inserts own deal offer"
  on public.deal_offers
  for insert
  to authenticated
  with check (buyer_id = auth.uid());

-- An offer is visible only to its two parties: the offering buyer
-- and the owner of the deal it belongs to. published_deals is
-- created in the Slice 132 migration, so this reference is not a
-- forward reference.
drop policy if exists "deal offer participants read offers" on public.deal_offers;
create policy "deal offer participants read offers"
  on public.deal_offers
  for select
  to authenticated
  using (
    buyer_id = auth.uid()
    or exists (
      select 1 from public.published_deals d
      where d.id = deal_offers.deal_id
        and d.user_id = auth.uid()
    )
  );

-- The deal owner accepts or declines offers on their own deals.
-- The app only ever sets 'accepted' or 'declined' through this
-- path (see lib/deal-offers.ts decideOffer).
drop policy if exists "deal owner decides offers" on public.deal_offers;
create policy "deal owner decides offers"
  on public.deal_offers
  for update
  to authenticated
  using (
    exists (
      select 1 from public.published_deals d
      where d.id = deal_offers.deal_id
        and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.published_deals d
      where d.id = deal_offers.deal_id
        and d.user_id = auth.uid()
    )
  );

-- The offering buyer withdraws only their own offer. The app only
-- ever sets 'withdrawn' through this path (see
-- lib/deal-offers.ts withdrawOffer).
drop policy if exists "buyer withdraws own offer" on public.deal_offers;
create policy "buyer withdraws own offer"
  on public.deal_offers
  for update
  to authenticated
  using (buyer_id = auth.uid())
  with check (buyer_id = auth.uid());

-- The operator reads every offer (support and oversight only).
drop policy if exists "operator reads all deal offers" on public.deal_offers;
create policy "operator reads all deal offers"
  on public.deal_offers
  for select
  to authenticated
  using (public.is_operator());

-- No DELETE policy: offers are never deleted, only withdrawn or
-- declined, so the record of what was offered stays. No anon
-- policy of any kind: signed-out visitors never read or write
-- offers.

-- Grants (see header — without these the app cannot touch the
-- table at all, RLS policies notwithstanding). No grant to anon.
grant select, insert, update, delete on public.deal_offers to authenticated;
grant select, insert, update, delete on public.deal_offers to service_role;

-- Rollback (only if this migration itself must be undone):
--   drop table if exists public.deal_offers;
