-- Legacy schema — buyers (10 live columns).
--
-- Columns (10), VERIFIED LIVE Nov 19, 2026: id uuid NO
-- gen_random_uuid(); owner_id uuid NO NULL; name text NO NULL;
-- buyer_type text NO NULL default 'cash'::text; states text[]
-- NO '{}'::text[]; buy_box text YES NULL; contact jsonb NO
-- '{}'::jsonb; tier integer YES NULL; verified_pof boolean NO
-- false; created_at timestamptz NO now(). The Nov 17 columns
-- dump had buyer_type nullable with NO default — wrong; the
-- live default is 'cash'. (Note, CONFIRMED LIVE Nov 19,
-- 17:31–17:36 EST: buyers_buyer_type_check IS live and requires
-- hedge_fund/cash_buyer/landlord/builder — so an insert that
-- omits buyer_type would get 'cash' from the default and fail
-- the CHECK. A real inconsistency in the legacy schema, recorded
-- as-is, not fixed. The table is empty, so it has never bitten
-- anyone.)
-- Policies are dropped before creation so the file re-runs cleanly.
-- Live baseline Nov 19, 2026: 0 rows.

create table if not exists public.buyers (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  buyer_type text not null default 'cash'::text,
  states text[] not null default '{}'::text[],
  buy_box text,
  contact jsonb not null default '{}'::jsonb,
  tier integer,
  verified_pof boolean not null default false,
  created_at timestamptz not null default now(),
  constraint buyers_buyer_type_check check (buyer_type in ('hedge_fund', 'cash_buyer', 'landlord', 'builder')),
  constraint buyers_tier_check check (tier between 1 and 3)
);

alter table public.buyers enable row level security;

drop policy if exists "owners manage own buyers" on public.buyers;
create policy "owners manage own buyers"
  on public.buyers
  for all
  to public
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Grants exactly as dumped (grants pattern A).
-- service_role holds NO data grants on any legacy table — recorded
-- as-is, do NOT add any.
grant references, trigger, truncate on public.buyers to anon;
grant delete, insert, references, select, trigger, truncate, update on public.buyers to authenticated;
grant select, insert, update, delete, references, trigger, truncate on public.buyers to postgres;
grant references, trigger, truncate on public.buyers to service_role;

-- Rollback (only if this migration itself must be undone):
--   drop table if exists public.buyers;
