-- Legacy-schema migration — documents the live schema as
-- VERIFIED LIVE Nov 19, 2026 (read-only re-dump, 17:21–17:31
-- EST). The Nov 17 columns dump listed the WRONG columns for
-- this table (escrow_file_id, destination, title_tracking,
-- wire_confirmation, updated_at) — a stale snapshot. The 11
-- live columns below are the truth. Table:
-- public.disbursements — 11 live columns.
--
-- This file documents the live schema exactly as verified. It
-- does NOT fix or improve anything: no foreign keys, no indexes,
-- and no defaults beyond those shown below (the dump lists NO
-- foreign keys and NO indexes for this table). RLS is enabled,
-- NOT forced.
--
-- NOT APPLIED. NOT LIVE. File on disk only — do not push,
-- migrate, deploy, or touch the live database with it except
-- through the normal migration process.
-- Live baseline Nov 19, 2026: 0 rows.

create table if not exists public.disbursements (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  deal_id uuid,
  amount numeric not null,
  method text not null,
  instructions jsonb not null default '{}'::jsonb,
  authorization_letter text,
  status text not null default 'draft'::text,
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  constraint disbursements_method_check check (method in ('wire', 'online', 'mailed_check')),
  constraint disbursements_status_check check (status in ('draft', 'sent_to_title', 'received'))
);

alter table public.disbursements enable row level security;

drop policy if exists "owners manage own disbursements" on public.disbursements;
create policy "owners manage own disbursements"
  on public.disbursements
  for all
  to public
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Grants exactly as dumped (Query 2, role_table_grants):
-- anon REFERENCES, TRIGGER, TRUNCATE; authenticated all 7;
-- postgres all 7; service_role REFERENCES, TRIGGER, TRUNCATE
-- ONLY (service_role holds NO data grants on any legacy table).
grant references, trigger, truncate on public.disbursements to anon;
grant select, insert, update, delete, references, trigger, truncate on public.disbursements to authenticated;
grant select, insert, update, delete, references, trigger, truncate on public.disbursements to postgres;
grant references, trigger, truncate on public.disbursements to service_role;
