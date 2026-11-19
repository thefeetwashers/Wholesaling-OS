-- Legacy schema — public.escrow_files (16 columns), as dumped from
-- the live WholesalingOS database on Nov 17, 2026
-- (~/workspace/legacy-schema-dump-20261117.md; Supabase project
-- nabztcwabkqhxyxcxarx, re-dump ~15:07 EST, columns ~15:35 EST).
-- This file DOCUMENTS the live schema verbatim. It does not fix,
-- improve, or modernise anything.
--
-- Columns, nullability, and defaults match the dump exactly. No
-- foreign keys and no indexes are listed in the dump, so none are
-- created here. RLS is ENABLED, NOT forced (dump: none forced).
--
-- The "title users read own company escrow files" policy joins
-- public.title_companies, written by the sibling migration
-- 20261119100300, which precedes this file. This file must precede
-- 20261119100900 (escrow_milestones), whose title-users policy
-- joins escrow_files.
--
-- Grants are reproduced exactly as dumped. service_role holds
-- REFERENCES, TRIGGER, TRUNCATE ONLY — no data grants on this
-- table (as on every legacy table); that is the live state,
-- recorded as-is, not an omission.
--
-- NOT APPLIED. NOT LIVE. Do not push, migrate, or deploy.
-- Live baseline Nov 19, 2026: 0 rows.

create table if not exists public.escrow_files (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  listing_id uuid not null,
  title_company_id uuid,
  emd_amount_required numeric not null,
  emd_status text not null default 'awaiting_wire',
  emd_deadline timestamptz,
  title_search_status text not null default 'not_started',
  closing_disclosure_url text,
  platform_tech_fee numeric,
  platform_fee_status text not null default 'unbilled',
  file_status text not null default 'opened',
  target_closing_date date,
  created_at timestamptz not null default now(),
  outcome text not null default 'open',
  outcome_at timestamptz,
  constraint escrow_files_emd_status_check check (emd_status in ('awaiting_wire', 'received_verified', 'deficient_cancelled')),
  constraint escrow_files_file_status_check check (file_status in ('opened', 'in_escrow', 'clear_to_close', 'successfully_closed', 'aborted_cancelled')),
  constraint escrow_files_outcome_check check (outcome in ('open', 'closed', 'fell_through')),
  constraint escrow_files_platform_fee_status_check check (platform_fee_status in ('unbilled', 'pending_payout', 'paid_settled')),
  constraint escrow_files_title_search_status_check check (title_search_status in ('not_started', 'in_progress', 'issues_found', 'clear_title'))
);

alter table public.escrow_files enable row level security;

drop policy if exists "owners manage own escrow files" on public.escrow_files;
create policy "owners manage own escrow files"
  on public.escrow_files
  for all
  to public
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "title users read own company escrow files" on public.escrow_files;
create policy "title users read own company escrow files"
  on public.escrow_files
  for select
  to authenticated
  using (exists (select 1 from title_companies tc where ((tc.id = escrow_files.title_company_id) and (tc.portal_user = auth.uid()))));

-- Grants, exactly as dumped (20 grants total). authenticated
-- holds all 7; no data grants to service_role.
grant references, trigger, truncate on public.escrow_files to anon;
grant delete, insert, references, select, trigger, truncate, update on public.escrow_files to authenticated;
grant select, insert, update, delete, references, trigger, truncate on public.escrow_files to postgres;
grant references, trigger, truncate on public.escrow_files to service_role;

-- Rollback (only if this migration itself must be undone):
--   drop table if exists public.escrow_files;
