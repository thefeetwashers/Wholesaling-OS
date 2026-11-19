-- Legacy-schema migration — documents the live schema as
-- VERIFIED LIVE Nov 19, 2026 (read-only re-dump, 17:21–17:31
-- EST). The Nov 17 columns dump listed the WRONG columns for
-- this table (headline, is_seller_financed,
-- seller_financing_terms, published_at) — a stale snapshot. The
-- 10 live columns below are the truth. Table:
-- public.marketplace_listings — 10 live columns.
--
-- This file documents the live schema exactly as verified. It
-- does NOT fix or improve anything: no foreign keys, no indexes,
-- and no defaults beyond those shown below (the dump lists NO
-- foreign keys and NO indexes for this table). RLS is enabled,
-- NOT forced.
--
-- This file MUST precede 20261119100600_legacy_deals.sql: the
-- deals policies' EXISTS subqueries reference
-- public.marketplace_listings.
--
-- NOT APPLIED. NOT LIVE. File on disk only — do not push,
-- migrate, deploy, or touch the live database with it except
-- through the normal migration process.
-- Live baseline Nov 19, 2026: 0 rows.

create table if not exists public.marketplace_listings (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  deal_id uuid not null,
  total_marketplace_cost numeric not null,
  visibility text not null default 'public'::text,
  listing_status text not null default 'draft'::text,
  locked_by_buyer_id uuid,
  lock_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_listings_listing_status_check check (listing_status in ('draft', 'active', 'locked_pending_emd', 'under_contract', 'closed')),
  constraint marketplace_listings_visibility_check check (visibility in ('public', 'private'))
);

alter table public.marketplace_listings enable row level security;

drop policy if exists "anyone reads active public listings" on public.marketplace_listings;
create policy "anyone reads active public listings"
  on public.marketplace_listings
  for select
  to anon
  using ((visibility = 'public'::text) and (listing_status = 'active'::text));

drop policy if exists "owners manage own listings" on public.marketplace_listings;
create policy "owners manage own listings"
  on public.marketplace_listings
  for all
  to public
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "signed-in users read active public listings" on public.marketplace_listings;
create policy "signed-in users read active public listings"
  on public.marketplace_listings
  for select
  to authenticated
  using ((visibility = 'public'::text) and (listing_status = 'active'::text));

-- Grants exactly as dumped (Query 2, role_table_grants):
-- anon REFERENCES, SELECT, TRIGGER, TRUNCATE; authenticated
-- all 7; postgres all 7; service_role REFERENCES, TRIGGER,
-- TRUNCATE ONLY (service_role holds NO data grants on any
-- legacy table).
grant references, select, trigger, truncate on public.marketplace_listings to anon;
grant select, insert, update, delete, references, trigger, truncate on public.marketplace_listings to authenticated;
grant select, insert, update, delete, references, trigger, truncate on public.marketplace_listings to postgres;
grant references, trigger, truncate on public.marketplace_listings to service_role;
