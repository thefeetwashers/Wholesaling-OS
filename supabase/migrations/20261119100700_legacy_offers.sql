-- Legacy schema — public.offers (10 columns), as VERIFIED LIVE
-- from the WholesalingOS database on Nov 19, 2026 (read-only
-- re-dump, 17:21–17:31 EST; Supabase project
-- nabztcwabkqhxyxcxarx). The Nov 17 columns dump listed the
-- WRONG columns for this table (owner_id, buyer_id,
-- offer_amount, emd_amount, proof_of_funds_url, accepted_at) —
-- a stale snapshot. The 10 live columns below are the truth,
-- and buyer_user / wholesaler_user ARE real columns, so the
-- policies below are consistent. This file DOCUMENTS the live
-- schema verbatim. It does not fix, improve, or modernise
-- anything.
--
-- Columns, nullability, and defaults match the live check
-- exactly. No foreign keys and no indexes are listed in the
-- dump, so none are created here. RLS is ENABLED, NOT forced.
--
-- Grants are reproduced exactly as dumped. service_role holds
-- REFERENCES, TRIGGER, TRUNCATE ONLY — no data grants on this
-- table (as on every legacy table); that is the live state,
-- recorded as-is, not an omission.
--
-- NOT APPLIED. NOT LIVE. Do not push, migrate, or deploy.
-- Live baseline Nov 19, 2026: 0 rows.

create table if not exists public.offers (
  id uuid not null default gen_random_uuid(),
  listing_id uuid not null,
  buyer_user uuid not null,
  wholesaler_user uuid not null,
  amount numeric not null,
  message text,
  status text not null default 'sent',
  counter_amount numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_status_check check (status in ('sent', 'countered', 'accepted', 'declined', 'withdrawn'))
);

alter table public.offers enable row level security;

drop policy if exists "buyers create offers" on public.offers;
create policy "buyers create offers"
  on public.offers
  for insert
  to authenticated
  with check (buyer_user = auth.uid());

drop policy if exists "parties read own offers" on public.offers;
create policy "parties read own offers"
  on public.offers
  for select
  to authenticated
  using ((buyer_user = auth.uid()) or (wholesaler_user = auth.uid()));

drop policy if exists "parties update own offers" on public.offers;
create policy "parties update own offers"
  on public.offers
  for update
  to authenticated
  using ((buyer_user = auth.uid()) or (wholesaler_user = auth.uid()))
  with check ((buyer_user = auth.uid()) or (wholesaler_user = auth.uid()));

-- Grants, exactly as dumped (19 grants total). No DELETE grant
-- to authenticated; no data grants to service_role.
grant references, trigger, truncate on public.offers to anon;
grant insert, references, select, trigger, truncate, update on public.offers to authenticated;
grant select, insert, update, delete, references, trigger, truncate on public.offers to postgres;
grant references, trigger, truncate on public.offers to service_role;

-- Rollback (only if this migration itself must be undone):
--   drop table if exists public.offers;
