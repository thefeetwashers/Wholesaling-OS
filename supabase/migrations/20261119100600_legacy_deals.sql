-- Legacy-schema migration — documents the live schema as dumped
-- Nov 17, 2026 (legacy-schema-dump-20261117.md, live DB re-dump
-- ~15:07 EST and columns dump ~15:35 EST). Table:
-- public.deals — 22 live columns.
--
-- This file documents the live schema exactly as dumped. It does
-- NOT fix or improve anything: no foreign keys, no indexes, and
-- no defaults beyond those shown in the dump (the dump lists NO
-- foreign keys and NO indexes for this table). RLS is enabled,
-- NOT forced (the dump says none forced).
--
-- This file MUST follow 20261119100500_legacy_marketplace_listings.sql:
-- the "anyone reads deals behind public listings" and "buyers
-- read deals behind public listings" policies contain EXISTS
-- subqueries on public.marketplace_listings (rows 5 and 7 of the
-- dump's pg_policies query; the two quals are character-identical).
--
-- NOT APPLIED. NOT LIVE. File on disk only — do not push,
-- migrate, deploy, or touch the live database with it except
-- through the normal migration process.
-- Live baseline Nov 19, 2026: 0 rows.

create table if not exists public.deals (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  lead_id uuid,
  contract_type text not null,
  contract_price numeric,
  arv numeric,
  repairs numeric,
  assignment_fee numeric,
  jv_split jsonb not null default '{}'::jsonb,
  buyer_id uuid,
  title_company text,
  emd_amount numeric,
  closing_date date,
  status text not null default 'draft'::text,
  documents jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  viewing_slots jsonb not null default '[]'::jsonb,
  confirmed_viewing jsonb not null default '{}'::jsonb,
  actual_sale_price numeric,
  actual_repairs numeric,
  seller_user uuid,
  constraint deals_contract_type_check check (contract_type in ('purchase', 'assignment', 'jv', 'novation', 'subject_to', 'seller_finance', 'lease_option', 'transactional_funding', 'sellers_disclosure'))
);

alter table public.deals enable row level security;

drop policy if exists "anyone reads deals behind public listings" on public.deals;
create policy "anyone reads deals behind public listings"
  on public.deals
  for select
  to anon
  using (exists (select 1 from marketplace_listings ml where ((ml.deal_id = deals.id) and (ml.visibility = 'public'::text) and (ml.listing_status = 'active'::text))));

drop policy if exists "buyers read accepted deals" on public.deals;
create policy "buyers read accepted deals"
  on public.deals
  for select
  to authenticated
  using ((documents ->> 'buyer_user'::text) = (auth.uid())::text);

drop policy if exists "buyers read deals behind public listings" on public.deals;
create policy "buyers read deals behind public listings"
  on public.deals
  for select
  to authenticated
  using (exists (select 1 from marketplace_listings ml where ((ml.deal_id = deals.id) and (ml.visibility = 'public'::text) and (ml.listing_status = 'active'::text))));

drop policy if exists "buyers update accepted deals" on public.deals;
create policy "buyers update accepted deals"
  on public.deals
  for update
  to authenticated
  using ((documents ->> 'buyer_user'::text) = (auth.uid())::text)
  with check ((documents ->> 'buyer_user'::text) = (auth.uid())::text);

drop policy if exists "owners manage own deals" on public.deals;
create policy "owners manage own deals"
  on public.deals
  for all
  to public
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "sellers claim unlinked deals" on public.deals;
create policy "sellers claim unlinked deals"
  on public.deals
  for update
  to authenticated
  using (seller_user is null)
  with check (seller_user = auth.uid());

drop policy if exists "sellers read linked deals" on public.deals;
create policy "sellers read linked deals"
  on public.deals
  for select
  to authenticated
  using (seller_user = auth.uid());

drop policy if exists "sellers update linked deals" on public.deals;
create policy "sellers update linked deals"
  on public.deals
  for update
  to authenticated
  using (seller_user = auth.uid())
  with check (seller_user = auth.uid());

-- Grants exactly as dumped (Query 2, role_table_grants):
-- anon REFERENCES, SELECT, TRIGGER, TRUNCATE; authenticated
-- all 7; postgres all 7; service_role REFERENCES, TRIGGER,
-- TRUNCATE ONLY (service_role holds NO data grants on any
-- legacy table).
grant references, select, trigger, truncate on public.deals to anon;
grant select, insert, update, delete, references, trigger, truncate on public.deals to authenticated;
grant select, insert, update, delete, references, trigger, truncate on public.deals to postgres;
grant references, trigger, truncate on public.deals to service_role;
