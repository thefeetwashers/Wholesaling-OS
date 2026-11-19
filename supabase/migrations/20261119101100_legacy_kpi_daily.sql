-- Legacy schema — kpi_daily (10 columns).
--
-- Columns VERIFIED LIVE Nov 19, 2026 (read-only re-dump,
-- 17:21–17:31 EST). The Nov 17 columns dump listed the WRONG
-- columns for this table (calls, offers, deals, closed,
-- gross_fees, created_at, updated_at) — a stale snapshot. The 10
-- live columns below are the truth. Nothing here is fixed or
-- improved: columns, defaults, policy, and grants are recorded
-- exactly as verified. The NO 0 defaults on the int/numeric
-- columns are recorded exactly — do NOT drop them.
--
-- Policy (1), verbatim from the dump's pg_policies row 19:
-- "owners manage own kpi", ALL, TO public,
-- USING (auth.uid() = owner_id), WITH CHECK (auth.uid() = owner_id).
--
-- No CHECK constraints on this table (per the dump).
--
-- Grants as dumped (pattern A): anon REFERENCES, TRIGGER,
-- TRUNCATE; authenticated DELETE, INSERT, REFERENCES, SELECT,
-- TRIGGER, TRUNCATE, UPDATE; postgres all 7; service_role
-- REFERENCES, TRIGGER, TRUNCATE ONLY — service_role holds NO data
-- grants on any legacy table; do NOT add any.
--
-- The dump lists NO foreign keys and NO indexes — none are added.
-- RLS enabled, NOT forced. NOT APPLIED. NOT LIVE.
-- Live baseline Nov 19, 2026: 0 rows.

create table if not exists public.kpi_daily (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  day date not null,
  lists_pulled integer not null default 0,
  calls_made integer not null default 0,
  conversations integer not null default 0,
  offers_sent integer not null default 0,
  contracts_signed integer not null default 0,
  assignments_closed integer not null default 0,
  fees_collected numeric not null default 0
);

alter table public.kpi_daily enable row level security;

drop policy if exists "owners manage own kpi" on public.kpi_daily;
create policy "owners manage own kpi"
  on public.kpi_daily
  for all
  to public
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

grant references, trigger, truncate on public.kpi_daily to anon;
grant delete, insert, references, select, trigger, truncate, update on public.kpi_daily to authenticated;
grant select, insert, update, delete, references, trigger, truncate on public.kpi_daily to postgres;
grant references, trigger, truncate on public.kpi_daily to service_role;
