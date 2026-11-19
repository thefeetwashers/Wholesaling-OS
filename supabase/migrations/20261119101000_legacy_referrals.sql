-- Legacy schema — referrals (14 columns).
--
-- Columns VERIFIED LIVE Nov 19, 2026 (read-only re-dump,
-- 17:21–17:31 EST). The Nov 17 columns dump listed the WRONG
-- columns for this table (owner_id, assigned_to, price, arv,
-- assigned, updated_at) — a stale snapshot. The 14 live columns
-- below are the truth: referrer_id and referrer_email ARE real
-- columns (lib/portals.ts also writes referrer_email on insert),
-- so all four policies below are consistent. Nothing here is
-- fixed or improved: columns, defaults, policies, CHECK
-- constraint, and grants are recorded exactly as verified.
--
-- Columns (14): id uuid NO gen_random_uuid(); referrer_id uuid
-- NO NULL; referrer_email text NO NULL; seller_name text NO
-- ''::text; property_address text YES NULL; city text NO
-- ''::text; state text NO ''::text; zip text NO ''::text;
-- seller_phone text NO ''::text; seller_email text NO
-- ''::text; relationship text YES NULL; notes text NO
-- ''::text; status text NO 'received'::text; created_at
-- timestamptz NO now().
--
-- Policies (4), recorded AS-IS: the two owner policies gate on the
-- operator email (auth.jwt() ->> 'email' = 'thefeetwashers@gmail.com')
-- and are NOT rewritten to is_operator().
--
-- Grants as dumped: anon REFERENCES, TRIGGER, TRUNCATE;
-- authenticated INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE,
-- UPDATE (no DELETE); postgres all 7; service_role REFERENCES,
-- TRIGGER, TRUNCATE ONLY — service_role holds NO data grants on
-- any legacy table; do NOT add any.
--
-- The dump lists NO foreign keys and NO indexes — none are added.
-- RLS enabled, NOT forced. NOT APPLIED. NOT LIVE.
-- Live baseline Nov 19, 2026: 0 rows.

create table if not exists public.referrals (
  id uuid not null default gen_random_uuid(),
  referrer_id uuid not null,
  referrer_email text not null,
  seller_name text not null default ''::text,
  property_address text,
  city text not null default ''::text,
  state text not null default ''::text,
  zip text not null default ''::text,
  seller_phone text not null default ''::text,
  seller_email text not null default ''::text,
  relationship text,
  notes text not null default ''::text,
  status text not null default 'received'::text,
  created_at timestamptz not null default now(),
  constraint referrals_status_check check (status in ('received', 'working', 'closed', 'dead'))
);

alter table public.referrals enable row level security;

drop policy if exists referrals_insert_own on public.referrals;
create policy referrals_insert_own
  on public.referrals
  for insert
  to authenticated
  with check (referrer_id = auth.uid());

drop policy if exists referrals_select_own on public.referrals;
create policy referrals_select_own
  on public.referrals
  for select
  to authenticated
  using (referrer_id = auth.uid());

drop policy if exists referrals_select_owner on public.referrals;
create policy referrals_select_owner
  on public.referrals
  for select
  to authenticated
  using ((auth.jwt() ->> 'email'::text) = 'thefeetwashers@gmail.com'::text);

drop policy if exists referrals_update_owner on public.referrals;
create policy referrals_update_owner
  on public.referrals
  for update
  to authenticated
  using ((auth.jwt() ->> 'email'::text) = 'thefeetwashers@gmail.com'::text)
  with check ((auth.jwt() ->> 'email'::text) = 'thefeetwashers@gmail.com'::text);

grant references, trigger, truncate on public.referrals to anon;
grant insert, references, select, trigger, truncate, update on public.referrals to authenticated;
grant select, insert, update, delete, references, trigger, truncate on public.referrals to postgres;
grant references, trigger, truncate on public.referrals to service_role;
