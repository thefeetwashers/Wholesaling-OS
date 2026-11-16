-- ============================================================================
-- WholesalingOS — Slice 127: Probate Lead Importer & Priority Database.
-- Migration file ONLY. NOT APPLIED. NOT LIVE.
--
-- Run this in the Supabase SQL editor (owner step) against the project
-- that already ran 20261115090000_capital_lending_lender_role.sql,
-- 20261115091500_capital_lending_fee_exact.sql,
-- 20261115110000_winwin_ecosystem.sql,
-- 20261115120000_slice123_leads_columns.sql,
-- 20261115130000_slice124_storefront.sql and
-- 20261115140000_slice125_seller_firsts.sql. Do NOT run it against any
-- other project. It is written to be idempotent: re-running it after
-- a successful run changes nothing. No leads, people, phone numbers,
-- emails, addresses, attorneys, or outcomes are created by this file.
--
-- Ordering (the Slice 122 lesson): the table is created first, then
-- its trigger, then its RLS policies. No policy or function in this
-- file references a table created later in the same file.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. probate_leads — one row per court case per wholesaler. The rows
--    come only from a docket CSV the wholesaler uploads or pastes
--    (lib/probate-import.ts groups the rows by Case Number); nothing
--    here is seeded, scraped, or invented. CLOSED cases are kept as
--    archived rows (the founder's standing rule: CLOSED Summary
--    Administration cases are still callable), and the app's default
--    view shows OPEN only.
--      user_id          — the wholesaler who owns the row (multi-
--                          tenant isolation, sealed-office pattern).
--      case_number      — e.g. '2026CP001433'; unique per user.
--      case_status      — 'OPEN' or 'CLOSED', as the docket states.
--      decedent_name    — cleaned primary decedent (birth years
--                          stripped by the parser; raw name kept in
--                          the import metadata, not in this table).
--      decedent_aliases — extra DECEDENT rows for the same case.
--      decision_makers  — jsonb array of {name, role, phone, email,
--                          mailing_address, skip_trace_status};
--                          phone/email/mailing_address start null
--                          and are filled ONLY by the wholesaler's
--                          own manual entry or a real skip-trace
--                          result — never invented.
--      has_attorney     — true when at least one ATTORNEY row exists
--                          for the case; is_pro_se is generated from
--                          it, so the two can never disagree.
--      attorney_names   — deduped attorney names, [] when Pro Se.
--      creditor_claims  — CLAIMANT rows (e.g. a hospital claim).
--      notes_flags      — auto-built summary flags from the parser.
--      property_address — null until the wholesaler finds it on the
--                          Property Appraiser or enters it by hand.
--      paslc_search_url — the appraiser site (https://paslc.gov);
--                          the UI copies the cleaned last name —
--                          no deep-link search URL is invented.
--      outreach_status  — the wholesaler's own pipeline state.
-- ----------------------------------------------------------------------------
create table if not exists public.probate_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  county text not null default 'St. Lucie County, FL',
  case_number text not null,
  case_status text not null default 'OPEN'
    check (case_status in ('OPEN', 'CLOSED')),
  decedent_name text,
  decedent_aliases text[] not null default '{}',
  decision_makers jsonb not null default '[]'::jsonb,
  has_attorney boolean not null default false,
  attorney_names text[] not null default '{}',
  is_pro_se boolean generated always as (not has_attorney) stored,
  creditor_claims text[] not null default '{}',
  notes_flags text not null default '',
  -- Slice 127 addition (not in the pasted schema): the wholesaler's
  -- own editable notes. They live here — NOT in notes_flags —
  -- because notes_flags is rebuilt by the parser on every
  -- re-import; a note stored there would be wiped by the next
  -- upload. The merge never touches this column.
  user_notes text not null default '',
  property_address text,
  paslc_search_url text,
  outreach_status text not null default 'New'
    check (outreach_status in ('New', 'Skip Traced', 'Contacted', 'Offer Sent', 'Under Contract', 'Dead')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint probate_leads_user_case_unique unique (user_id, case_number)
);

create index if not exists probate_leads_user_status_idx
  on public.probate_leads (user_id, case_status);
create index if not exists probate_leads_user_pro_se_idx
  on public.probate_leads (user_id, is_pro_se)
  where case_status = 'OPEN';

drop trigger if exists probate_leads_set_updated_at on public.probate_leads;
create trigger probate_leads_set_updated_at
  before update on public.probate_leads
  for each row execute function public.set_updated_at();

alter table public.probate_leads enable row level security;

-- A wholesaler reads, inserts, updates, and deletes only their
-- own probate leads (four policies, one per operation).
drop policy if exists "wholesaler reads own probate leads" on public.probate_leads;
create policy "wholesaler reads own probate leads"
  on public.probate_leads
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "wholesaler inserts own probate leads" on public.probate_leads;
create policy "wholesaler inserts own probate leads"
  on public.probate_leads
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "wholesaler updates own probate leads" on public.probate_leads;
create policy "wholesaler updates own probate leads"
  on public.probate_leads
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "wholesaler deletes own probate leads" on public.probate_leads;
create policy "wholesaler deletes own probate leads"
  on public.probate_leads
  for delete
  to authenticated
  using (user_id = auth.uid());

-- The operator reads every wholesaler's probate leads (support and
-- oversight only — the operator never edits another office's rows).
drop policy if exists "operator reads all probate leads" on public.probate_leads;
create policy "operator reads all probate leads"
  on public.probate_leads
  for select
  to authenticated
  using (public.is_operator());

-- Rollback (only if this migration itself must be undone):
--   drop table if exists public.probate_leads;

-- ----------------------------------------------------------------------------
-- 2. Probate tag on the EXISTING leads table (Slice 127, sixth
--    follow-up). The Copy Storefront Link button in the Probate
--    Leads view builds /sell/<slug>?case=<case_number>; the sell
--    page reads the `case` param and carries it through both
--    steps of the two-step form, so the tag lands on the lead.
--    NO new table is created for this: seller submissions live
--    in public.leads (list_source 'Seller landing page') via the
--    submit_seller_lead_v2 / complete_seller_lead RPCs, and a
--    second leads table would split leads and break the dashboard,
--    the tracker, and the sealed-office RLS. The partial index
--    below lets the dashboard find probate-tagged leads.
-- ----------------------------------------------------------------------------
alter table public.leads
  add column if not exists probate_case_number text;

create index if not exists idx_leads_probate_case
  on public.leads (probate_case_number)
  where probate_case_number is not null;

-- submit_seller_lead_v2 — step 1, extended with the probate tag.
-- The Slice 124 version is dropped first (a new signature is a
-- new overload in Postgres, so dropping keeps exactly one
-- function) and recreated with the same body plus one defaulted
-- parameter. Every new parameter has a default, so a call with
-- only the original parameters behaves identically to before.
drop function if exists public.submit_seller_lead_v2(text, text, text, text, text, text, text, text, text, text, boolean, boolean, text, text, text, text, numeric);

create or replace function public.submit_seller_lead_v2(
  p_slug text,
  p_owner_name text,
  p_property_address text,
  p_city text,
  p_state text,
  p_zip text,
  p_phone text,
  p_email text,
  p_notes text,
  p_website text,
  p_is_partial boolean default false,
  p_consent boolean default false,
  p_property_type text default null,
  p_condition text default null,
  p_occupancy text default null,
  p_timeline text default null,
  p_asking_price numeric default null,
  p_probate_case_number text default null
)
returns text
language plpgsql
security definer
as $$
declare
  v_id text;
begin
  v_id := (public.submit_seller_lead(
    p_slug, p_owner_name, p_property_address, p_city, p_state, p_zip,
    p_phone, p_email, p_notes, p_website
  ))::text;
  if v_id is null or v_id = '' then
    return null;
  end if;
  update public.leads
     set is_partial = p_is_partial,
         property_type = coalesce(p_property_type, property_type),
         condition = coalesce(p_condition, condition),
         occupancy = coalesce(p_occupancy, occupancy),
         timeline = coalesce(p_timeline, timeline),
         asking_price = coalesce(p_asking_price, asking_price),
         probate_case_number = coalesce(nullif(trim(coalesce(p_probate_case_number, '')), ''), probate_case_number),
         consent_status = case when p_consent then 'express_consent' else consent_status end,
         consent_at = case when p_consent then now() else consent_at end,
         consent_source = case when p_consent then 'Seller page (call/text consent)' else consent_source end
   where id = v_id::uuid;
  return v_id;
end;
$$;

-- complete_seller_lead — step 2, extended with the probate tag.
-- The Slice 125 (17-param) version is dropped first for the same
-- overload reason, and recreated with the same guards — slug
-- resolves to an enabled, unsuspended seller page; the lead
-- belongs to that page's owner, source 'Seller landing page',
-- created within the last 2 hours — plus the new step-2 field.
drop function if exists public.complete_seller_lead(text, text, text, text, text, text, text, text, text, numeric, text, date, boolean, text, text, text, text);

create or replace function public.complete_seller_lead(
  p_slug text,
  p_lead_id text,
  p_city text,
  p_state text,
  p_zip text,
  p_property_type text,
  p_condition text,
  p_occupancy text,
  p_timeline text,
  p_asking_price numeric,
  p_notes text,
  p_preferred_closing_date date default null,
  p_inherited_home boolean default false,
  p_estate_role text default null,
  p_letters_issued text default null,
  p_court_approval text default null,
  p_estate_notes text default null,
  p_probate_case_number text default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_owner uuid;
  v_lead_owner uuid;
  v_source text;
  v_created timestamptz;
begin
  if p_lead_id is null or p_lead_id = '' then
    return false;
  end if;
  select id into v_owner
    from public.profiles
   where public_slug = lower(trim(p_slug))
     and seller_page_enabled = true
     and admin_suspended = false;
  if v_owner is null then
    return false;
  end if;
  select owner_id, list_source, created_at
    into v_lead_owner, v_source, v_created
    from public.leads
   where id = p_lead_id::uuid;
  if v_lead_owner is null or v_lead_owner <> v_owner then
    return false;
  end if;
  if v_source <> 'Seller landing page' then
    return false;
  end if;
  if now() - v_created > interval '2 hours' then
    return false;
  end if;
  update public.leads
     set city = nullif(trim(coalesce(p_city, '')), ''),
         state = nullif(trim(coalesce(p_state, '')), ''),
         zip = nullif(trim(coalesce(p_zip, '')), ''),
         property_type = nullif(trim(coalesce(p_property_type, '')), ''),
         condition = nullif(trim(coalesce(p_condition, '')), ''),
         occupancy = nullif(trim(coalesce(p_occupancy, '')), ''),
         timeline = nullif(trim(coalesce(p_timeline, '')), ''),
         asking_price = p_asking_price,
         notes = p_notes,
         is_partial = false,
         preferred_closing_date = p_preferred_closing_date,
         inherited_home = coalesce(p_inherited_home, false),
         estate_role = case when coalesce(p_inherited_home, false) then nullif(trim(coalesce(p_estate_role, '')), '') else null end,
         letters_issued = case when coalesce(p_inherited_home, false) then nullif(trim(coalesce(p_letters_issued, '')), '') else null end,
         court_approval = case when coalesce(p_inherited_home, false) then nullif(trim(coalesce(p_court_approval, '')), '') else null end,
         estate_notes = case when coalesce(p_inherited_home, false) then nullif(trim(coalesce(p_estate_notes, '')), '') else null end,
         probate_case_number = coalesce(nullif(trim(coalesce(p_probate_case_number, '')), ''), probate_case_number)
   where id = p_lead_id::uuid;
  return found;
end;
$$;

-- Rollback for section 2 (only if this migration itself must be
-- undone; section 1's rollback is above):
--   drop function if exists public.submit_seller_lead_v2(text, text, text, text, text, text, text, text, text, text, boolean, boolean, text, text, text, text, numeric, text);
--   drop function if exists public.complete_seller_lead(text, text, text, text, text, text, text, text, text, numeric, text, date, boolean, text, text, text, text, text);
--   -- NOTE: dropping the functions leaves the Slice 124/125
--   -- versions gone; re-run 20261115130000_slice124_storefront.sql
--   -- and 20261115140000_slice125_seller_firsts.sql to restore
--   -- them (both are idempotent).
--   drop index if exists public.idx_leads_probate_case;
--   alter table public.leads drop column if exists probate_case_number;

-- ---------------------------------------------------------------------------
-- SECTION 3 (added Nov 16, 2026 — workflow gap fix, same push):
-- probate_lead_activity — append-only contact history for probate
-- leads. The lead carries outreach_status + editable notes, but no
-- record of WHEN and HOW it was contacted; a second call had no
-- memory of the first. One row is written ONLY when the wholesaler
-- actually contacts the decision-maker: the outreach modal's
-- "I sent this — Mark as Contacted" button (activity_type sms or
-- email) and the print modal's "I mailed this" button (mail).
-- Copying, opening an app, or printing alone writes NOTHING.
-- No fake history rows, ever. No updated_at column — append-only.
-- ---------------------------------------------------------------------------

create table if not exists public.probate_lead_activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.probate_leads (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  activity_type text not null check (activity_type in ('call', 'sms', 'email', 'mail', 'note')),
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.probate_lead_activity enable row level security;

create index if not exists idx_probate_lead_activity_lead
  on public.probate_lead_activity (lead_id, created_at desc);

drop policy if exists "wholesaler reads own probate activity" on public.probate_lead_activity;
create policy "wholesaler reads own probate activity"
  on public.probate_lead_activity
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "wholesaler inserts own probate activity" on public.probate_lead_activity;
create policy "wholesaler inserts own probate activity"
  on public.probate_lead_activity
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "wholesaler deletes own probate activity" on public.probate_lead_activity;
create policy "wholesaler deletes own probate activity"
  on public.probate_lead_activity
  for delete
  to authenticated
  using (user_id = auth.uid());

-- The operator reads every wholesaler's probate activity (support
-- and oversight only — the operator never edits another office's rows).
drop policy if exists "operator reads all probate activity" on public.probate_lead_activity;
create policy "operator reads all probate activity"
  on public.probate_lead_activity
  for select
  to authenticated
  using (public.is_operator());

-- Rollback for section 3 (only if this migration itself must be undone):
--   drop table if exists public.probate_lead_activity;
