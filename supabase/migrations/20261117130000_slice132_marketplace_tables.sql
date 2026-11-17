-- Slice 132 — Public off-market deals marketplace + managed
-- disposition requests.
--
-- Tables:
--   public.published_deals — a wholesaler's OPT-IN public
--     listing of one of their own deals. Nothing is published
--     automatically; the wholesaler taps "Publish as a deal" on
--     their own lead and confirms. No street address is stored
--     here (ZIP-only location on the public pages), no seller
--     contact, no photos (no photo flow exists). Money fields are
--     empty unless the wholesaler typed a real value.
--   public.deal_responses — a signed-in buyer's response to a
--     published deal. Contact is shared only when BOTH sides
--     opt in (owner_contact_shared AND responder_contact_shared),
--     the same mutual-opt-in pattern as the JV deal room
--     (lib/jv-room.ts). There is no in-app chat.
--   public.managed_dispo_requests — a wholesaler's REQUEST that
--     the operator market one of their deals to the buyer network
--     for them. A request is not a booking; the fee is agreed in
--     writing before work starts; no fee is stored here.
--
-- RLS + GRANTS ARE IN THIS FILE (the Nov 17 lesson): tables
-- created by migrations get NO data grants by default, so without
-- the grants below the app gets "permission denied" and the
-- feature silently does nothing. The RLS policies remain the real
-- gate. Policies are dropped before creation so the file re-runs
-- cleanly. The updated_at trigger reuses public.set_updated_at()
-- from Slice 122 — no second function. No policy or function here
-- references a table created later in this file:
-- public.is_operator() and public.set_updated_at() already exist.
--
-- No fake data is seeded. No OBL data of any kind is stored here.

create table if not exists public.published_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  city text,
  state text,
  zip text,
  -- Slice 132 follow-up (2)(1): the Florida county the deal is
  -- in, from the wholesaler's lead when known, editable in the
  -- publish form, EMPTY by default. Buy-box matching reads this
  -- column (see lib/match-buy-box.ts).
  county text,
  property_type text,
  beds int,
  baths numeric,
  sqft int,
  year_built int,
  lot_size text,
  -- Condition is one of exactly five values, pinned everywhere
  -- (publish form, detail page, filters, matching):
  -- 'Turnkey', 'Light rehab', 'Moderate rehab', 'Heavy rehab',
  -- 'Gut rehab'. No other value is used.
  condition text,
  occupancy text,
  strategy text,
  asking_price numeric,
  arv_low numeric,
  arv_high numeric,
  repair_estimate numeric,
  close_by date,
  highlights text,
  notes text,
  -- Wholesaler-entered sold comparables only, max 4. Each comp:
  -- address, sold_price, beds, baths, sqft, sold_date — every
  -- comp field optional, blank reads "not provided". NEVER
  -- invented by the platform.
  comps jsonb not null default '[]',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.published_deals enable row level security;

create index if not exists idx_published_deals_published_created
  on public.published_deals (published, created_at desc);
create index if not exists idx_published_deals_user
  on public.published_deals (user_id);
create index if not exists idx_published_deals_county
  on public.published_deals (county);

drop trigger if exists published_deals_set_updated_at on public.published_deals;
create trigger published_deals_set_updated_at
  before update on public.published_deals
  for each row execute function public.set_updated_at();

-- Anyone (signed out or in) may read published deals. This is the
-- public marketplace page; the row itself carries no street
-- address and no seller contact.
drop policy if exists "public reads published deals" on public.published_deals;
create policy "public reads published deals"
  on public.published_deals
  for select
  to anon, authenticated
  using (published = true);

-- The owner manages only their own rows.
drop policy if exists "owner inserts own published deal" on public.published_deals;
create policy "owner inserts own published deal"
  on public.published_deals
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "owner updates own published deal" on public.published_deals;
create policy "owner updates own published deal"
  on public.published_deals
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "owner deletes own published deal" on public.published_deals;
create policy "owner deletes own published deal"
  on public.published_deals
  for delete
  to authenticated
  using (user_id = auth.uid());

-- The operator reads every published deal, including unpublished
-- ones (support and oversight only).
drop policy if exists "operator reads all published deals" on public.published_deals;
create policy "operator reads all published deals"
  on public.published_deals
  for select
  to authenticated
  using (public.is_operator());

create table if not exists public.deal_responses (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.published_deals (id) on delete cascade,
  responder_id uuid not null references auth.users (id) on delete cascade,
  message text not null default '',
  owner_contact_shared boolean not null default false,
  responder_contact_shared boolean not null default false,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.deal_responses enable row level security;

create index if not exists idx_deal_responses_deal
  on public.deal_responses (deal_id);
create index if not exists idx_deal_responses_responder
  on public.deal_responses (responder_id);

-- A signed-in buyer responds to a deal. One response row per
-- insert; the app does not invent responses.
drop policy if exists "responder inserts own deal response" on public.deal_responses;
create policy "responder inserts own deal response"
  on public.deal_responses
  for insert
  to authenticated
  with check (responder_id = auth.uid());

-- The deal owner and the responder read the rows between them.
-- published_deals is created above, so this reference is not a
-- forward reference.
drop policy if exists "deal participants read responses" on public.deal_responses;
create policy "deal participants read responses"
  on public.deal_responses
  for select
  to authenticated
  using (
    responder_id = auth.uid()
    or exists (
      select 1 from public.published_deals d
      where d.id = deal_responses.deal_id
        and d.user_id = auth.uid()
    )
  );

-- Either participant may update a response row — in practice the
-- app only flips that side's own *_contact_shared flag (mutual
-- opt-in: contact is shown only when both flags are true).
drop policy if exists "deal participants update responses" on public.deal_responses;
create policy "deal participants update responses"
  on public.deal_responses
  for update
  to authenticated
  using (
    responder_id = auth.uid()
    or exists (
      select 1 from public.published_deals d
      where d.id = deal_responses.deal_id
        and d.user_id = auth.uid()
    )
  )
  with check (
    responder_id = auth.uid()
    or exists (
      select 1 from public.published_deals d
      where d.id = deal_responses.deal_id
        and d.user_id = auth.uid()
    )
  );

-- The operator reads every response (support and oversight only).
drop policy if exists "operator reads all deal responses" on public.deal_responses;
create policy "operator reads all deal responses"
  on public.deal_responses
  for select
  to authenticated
  using (public.is_operator());

create table if not exists public.managed_dispo_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  property_address text,
  city text,
  state text,
  asking_price numeric,
  arv numeric,
  repair_estimate numeric,
  notes text not null default '',
  -- requested → under_review → accepted/declined → completed.
  -- A request is a REQUEST, not a booking. The fee is agreed in
  -- writing before work starts; no fee is stored here.
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.managed_dispo_requests enable row level security;

create index if not exists idx_managed_dispo_user
  on public.managed_dispo_requests (user_id);
create index if not exists idx_managed_dispo_status
  on public.managed_dispo_requests (status, created_at desc);

drop trigger if exists managed_dispo_requests_set_updated_at on public.managed_dispo_requests;
create trigger managed_dispo_requests_set_updated_at
  before update on public.managed_dispo_requests
  for each row execute function public.set_updated_at();

drop policy if exists "owner inserts own dispo request" on public.managed_dispo_requests;
create policy "owner inserts own dispo request"
  on public.managed_dispo_requests
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "owner reads own dispo requests" on public.managed_dispo_requests;
create policy "owner reads own dispo requests"
  on public.managed_dispo_requests
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "operator reads all dispo requests" on public.managed_dispo_requests;
create policy "operator reads all dispo requests"
  on public.managed_dispo_requests
  for select
  to authenticated
  using (public.is_operator());

drop policy if exists "operator updates dispo request status" on public.managed_dispo_requests;
create policy "operator updates dispo request status"
  on public.managed_dispo_requests
  for update
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());

-- Grants (see header — without these the app cannot touch the
-- tables at all, RLS policies notwithstanding).
grant select, insert, update, delete on public.published_deals to authenticated;
grant select, insert, update, delete on public.published_deals to service_role;
grant select on public.published_deals to anon;
grant select, insert, update, delete on public.deal_responses to authenticated;
grant select, insert, update, delete on public.deal_responses to service_role;
grant select, insert, update, delete on public.managed_dispo_requests to authenticated;
grant select, insert, update, delete on public.managed_dispo_requests to service_role;

-- Rollback (only if this migration itself must be undone):
--   drop table if exists public.managed_dispo_requests;
--   drop table if exists public.deal_responses;
--   drop table if exists public.published_deals;
