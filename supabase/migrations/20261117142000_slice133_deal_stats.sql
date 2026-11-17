-- Slice 133 — Deal attention stats: real views, real response
-- counts, real price history. No fake numbers anywhere.
--
-- Tables:
--   public.deal_views — one row per counted page view of a
--     published deal. Written ONLY by the service-role API route
--     app/api/deal-view/route.ts (the same server-side
--     service-role pattern as app/api/track/[token]/route.ts).
--     There is NO anon INSERT policy on this table — the anon key
--     is public, so a client-side write would be world-writable
--     and the count would be fakeable. RLS is enabled and NO
--     policy grants anon/authenticated any access at all; the
--     service role bypasses RLS, so the API route is the only
--     reader/writer. The client dedupes per browser session
--     (sessionStorage) so one visit counts once; the number shown
--     is counted page loads, not unique visitors, and the
--     component says so.
--   public.deal_price_history — one row per recorded asking-price
--     value for a published deal: the initial price at publish
--     time (old_price NULL) and one row per later change
--     (old_price -> new_price). The initial row is written by
--     publishDeal in lib/published-deals.ts right after the deal
--     row is created. There is NO edit flow for a published
--     deal's asking price in the app today (only publish /
--     unpublish / re-publish touch published_deals), so later
--     change rows appear only if an edit flow is added later and
--     records them. A price drop is shown ONLY when a real
--     earlier price exists in this table — never an invented
--     prior price. Deals published before this migration have no
--     rows here, and the component says their price history was
--     not recorded rather than guessing.
--
-- Response counts are NOT stored: they are counted live from the
-- real public.deal_responses rows by the same API route.
-- Days on market is computed from published_deals.created_at in
-- the component — no table needed.
--
-- RLS + GRANTS ARE IN THIS FILE (the Nov 17 lesson): tables
-- created by migrations get NO data grants by default. Policies
-- are dropped before creation so the file re-runs cleanly. No
-- policy or function here references a table created later in
-- this file: public.published_deals exists from Slice 132
-- (migration 20261117130000) and public.is_operator() already
-- exists. No fake data is seeded. No OBL data of any kind.

create table if not exists public.deal_views (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.published_deals (id) on delete cascade,
  viewed_at timestamptz not null default now()
);

alter table public.deal_views enable row level security;

create index if not exists idx_deal_views_deal
  on public.deal_views (deal_id, viewed_at desc);

-- Deliberately NO policy for anon or authenticated on
-- deal_views: the service-role API route is the only writer and
-- reader. Any client-side policy here would let anyone inflate
-- the count.

create table if not exists public.deal_price_history (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.published_deals (id) on delete cascade,
  -- The price before this change. NULL on the initial row: the
  -- deal had no earlier published price.
  old_price numeric,
  new_price numeric,
  changed_at timestamptz not null default now()
);

alter table public.deal_price_history enable row level security;

create index if not exists idx_deal_price_history_deal
  on public.deal_price_history (deal_id, changed_at);

-- Price history of a PUBLISHED deal is public information, the
-- same as the deal row itself. Unpublished deals show nothing.
drop policy if exists "public reads deal price history" on public.deal_price_history;
create policy "public reads deal price history"
  on public.deal_price_history
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.published_deals d
      where d.id = deal_price_history.deal_id
        and d.published = true
    )
  );

-- The deal owner records a price row for their own deal (the
-- initial price at publish time; later rows only from an edit
-- flow that records them). No other authenticated user may
-- insert rows for a deal they do not own.
drop policy if exists "owner inserts own deal price history" on public.deal_price_history;
create policy "owner inserts own deal price history"
  on public.deal_price_history
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.published_deals d
      where d.id = deal_price_history.deal_id
        and d.user_id = auth.uid()
    )
  );

-- The operator reads every deal's price history, including
-- unpublished ones (support and oversight only).
drop policy if exists "operator reads all deal price history" on public.deal_price_history;
create policy "operator reads all deal price history"
  on public.deal_price_history
  for select
  to authenticated
  using (public.is_operator());

-- Grants (see header — without these the app cannot touch the
-- tables at all, RLS policies notwithstanding).
grant select, insert, update, delete on public.deal_views to service_role;
grant select, insert, update, delete on public.deal_price_history to service_role;
grant select on public.deal_price_history to anon;
grant select, insert on public.deal_price_history to authenticated;

-- Rollback (only if this migration itself must be undone):
--   drop table if exists public.deal_price_history;
--   drop table if exists public.deal_views;
