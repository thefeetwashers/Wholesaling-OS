-- Legacy schema — public.escrow_milestones (6 columns), as
-- VERIFIED LIVE from the WholesalingOS database on Nov 19, 2026
-- (read-only re-dump, 17:21–17:31 EST; Supabase project
-- nabztcwabkqhxyxcxarx). The Nov 17 columns dump listed the
-- WRONG columns for this table (escrow_file_id, milestone,
-- completed_at, created_at) — a stale snapshot. The 6 live
-- columns below are the truth, and file_id IS a real column, so
-- the "title users read own company milestones" policy below is
-- consistent. This file DOCUMENTS the live schema verbatim. It
-- does not fix, improve, or modernise anything.
--
-- Columns, nullability, and defaults match the live check
-- exactly. No CHECK constraints exist on this table. No foreign
-- keys and no indexes are listed in the dump, so none are created
-- here. RLS is ENABLED, NOT forced.
--
-- This file follows 20261119100800 (escrow_files), which the
-- title-users policy joins, and 20261119100300 (title_companies).
--
-- Grants are reproduced exactly as dumped. service_role holds
-- REFERENCES, TRIGGER, TRUNCATE ONLY — no data grants on this
-- table (as on every legacy table); that is the live state,
-- recorded as-is, not an omission.
--
-- NOT APPLIED. NOT LIVE. Do not push, migrate, or deploy.
-- Live baseline Nov 19, 2026: 0 rows.

create table if not exists public.escrow_milestones (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  file_id uuid not null,
  milestone_name text not null,
  notes text,
  logged_at timestamptz not null default now()
);

alter table public.escrow_milestones enable row level security;

drop policy if exists "owners insert own milestones" on public.escrow_milestones;
create policy "owners insert own milestones"
  on public.escrow_milestones
  for insert
  to public
  with check (auth.uid() = owner_id);

drop policy if exists "owners read own milestones" on public.escrow_milestones;
create policy "owners read own milestones"
  on public.escrow_milestones
  for select
  to public
  using (auth.uid() = owner_id);

drop policy if exists "title users read own company milestones" on public.escrow_milestones;
create policy "title users read own company milestones"
  on public.escrow_milestones
  for select
  to authenticated
  using (exists (select 1 from (escrow_files ef join title_companies tc on ((tc.id = ef.title_company_id))) where ((ef.id = escrow_milestones.file_id) and (tc.portal_user = auth.uid()))));

-- Grants, exactly as dumped (18 grants total). authenticated
-- holds INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE only — no
-- DELETE, no UPDATE. No data grants to service_role.
grant references, trigger, truncate on public.escrow_milestones to anon;
grant insert, references, select, trigger, truncate on public.escrow_milestones to authenticated;
grant select, insert, update, delete, references, trigger, truncate on public.escrow_milestones to postgres;
grant references, trigger, truncate on public.escrow_milestones to service_role;

-- Rollback (only if this migration itself must be undone):
--   drop table if exists public.escrow_milestones;
