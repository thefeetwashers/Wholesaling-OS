-- ============================================================================
-- WholesalingOS — Slice 123: distress-list columns on the leads table.
-- Migration file ONLY. NOT APPLIED. NOT LIVE.
--
-- Run this in the Supabase SQL editor (owner step) against the project
-- that already ran 20261115090000_capital_lending_lender_role.sql,
-- 20261115091500_capital_lending_fee_exact.sql and
-- 20261115110000_winwin_ecosystem.sql. Do NOT run it against any other
-- project. It is written to be idempotent: re-running it after a
-- successful run changes nothing. No secrets, keys, vendors, scouts,
-- leads, partners, or deals are created by this file.
--
-- The leads table already exists (see lib/leads.ts — owner_id, zip,
-- list_source, status new/contacted/qualified/under_contract/
-- assigned/closed/dead). This file only ADDS two columns to it:
--   distress_tag      — the signal the list itself carries
--                       (tax_delinquent, lis_pendens, probate,
--                       code_violation, vacant_absentee, tax_deed)
--   is_absentee_owner — true when the owner's mailing address
--                       differs from the property (situs) address
-- No RLS change: the leads table's existing sealed-office policies
-- already fence every row to its owner.
-- ============================================================================

alter table public.leads
  add column if not exists distress_tag text;

alter table public.leads
  add column if not exists is_absentee_owner boolean default false;

-- Rollback (only if this migration itself must be undone; the
-- importer keeps working without these columns — it stamps the
-- tag into the lead's notes instead — so undoing is optional):
--   alter table public.leads drop column if exists distress_tag;
--   alter table public.leads drop column if exists is_absentee_owner;
