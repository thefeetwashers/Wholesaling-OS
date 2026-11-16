-- Slice 129 — owner contact on leads (Google skip-trace saves).
--
-- The shared GoogleSkipTraceModal saves the single phone/email the
-- wholesaler chose for a distressed or inbound lead. The leads
-- table already has phones[]/emails[] arrays (the lead's full
-- contact lists); these two nullable columns hold the skip-traced
-- pair. Nothing else changes — no new table, no owner_phone on any
-- other table. (The pasted distressed_leads table does not exist
-- and must NOT be created; distress lives in leads.distress_tag.)

alter table public.leads
  add column if not exists owner_phone text,
  add column if not exists owner_email text;
