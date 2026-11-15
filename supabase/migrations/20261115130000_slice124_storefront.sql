-- ============================================================================
-- WholesalingOS — Slice 124: seller storefront profiles + two-step
-- seller form support.
-- Migration file ONLY. NOT APPLIED. NOT LIVE.
--
-- Run this in the Supabase SQL editor (owner step) against the project
-- that already ran 20261115090000_capital_lending_lender_role.sql,
-- 20261115091500_capital_lending_fee_exact.sql,
-- 20261115110000_winwin_ecosystem.sql and
-- 20261115120000_slice123_leads_columns.sql. Do NOT run it against
-- any other project. It is written to be idempotent: re-running it
-- after a successful run changes nothing. No secrets, keys, vendors,
-- scouts, leads, partners, or deals are created by this file.
--
-- Ordering (the Slice 122 lesson): every object is created before
-- anything references it. Section 1 creates storefront_profiles and
-- its policies; section 2 adds columns to the existing leads table;
-- section 3 creates the two seller-lead functions, which reference
-- both tables and the existing submit_seller_lead function. No
-- policy or function in this file references a table created later
-- in the same file.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. storefront_profiles — one public storefront profile per
--    wholesaler, keyed by their user id. This table holds ONLY
--    fields the wholesaler chooses to publish on their public
--    /sell/<slug> page: name, company, logo/headshot URLs, a public
--    phone and email, service areas, buy-box property types, a short
--    bio, an optional title company and booking link, their own
--    turnaround promise and response-time text, their own offer
--    terms for the comparison table, and optional testimonials and
--    past-deal cards they enter themselves. NOTHING private lives
--    here: no private email, no internal notes, no lead data, no
--    account details. That is why the public may read it (policy
--    below) — there is nothing in it that is not already public.
--    The public_slug column mirrors profiles.public_slug so the
--    public page can find the row by slug without ever reading
--    profiles (profiles stay unexposed to anonymous visitors, as
--    before). It is kept in sync by the app whenever the wholesaler
--    saves either settings panel.
-- ----------------------------------------------------------------------------
create table if not exists public.storefront_profiles (
  wholesaler_id uuid primary key references public.profiles (id) on delete cascade,
  public_slug text not null unique,
  display_name text,
  title text,
  company_name text,
  logo_url text,
  headshot_url text,
  public_phone text,
  public_email text,
  service_areas text[] not null default '{}',
  property_types text[] not null default '{}',
  seller_bio text,
  title_company text,
  booking_link text,
  turnaround_promise text,
  response_time_text text,
  offer_fees text,
  offer_repairs text,
  offer_close_days text,
  offer_closing_costs text,
  testimonials jsonb not null default '[]'::jsonb,
  past_deals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storefront_bio_250 check (seller_bio is null or char_length(seller_bio) <= 250)
);

drop trigger if exists storefront_profiles_set_updated_at on public.storefront_profiles;
create trigger storefront_profiles_set_updated_at
  before update on public.storefront_profiles
  for each row execute function public.set_updated_at();

alter table public.storefront_profiles enable row level security;

-- The public reads storefront profiles: every column in this table
-- is something the wholesaler chose to publish. Anonymous visitors
-- and signed-in users alike read it; the app only ever shows these
-- fields on the public page.
drop policy if exists "public reads storefront profiles" on public.storefront_profiles;
create policy "public reads storefront profiles"
  on public.storefront_profiles
  for select
  to anon, authenticated
  using (true);

-- A wholesaler manages only their own row.
drop policy if exists "wholesaler manages own storefront profile" on public.storefront_profiles;
create policy "wholesaler manages own storefront profile"
  on public.storefront_profiles
  for all
  to authenticated
  using (wholesaler_id = auth.uid())
  with check (wholesaler_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. Seller-lead columns on the existing leads table. The table
--    already exists (see lib/leads.ts); this only ADDS what the
--    two-step seller form needs. No RLS change: the leads table's
--    existing sealed-office policies already fence every row to its
--    owner.
--      is_partial     — true while the seller has finished step 1
--                        (address + contact) but not step 2; the
--                        dashboard shows these as "Partial — step 1
--                        only" so the wholesaler follows up.
--      property_type  — Single-Family / Multi-Family / Vacant Land /
--                        Townhouse-Condo (step 2 toggle).
--      condition      — Needs Major Repairs / Cosmetic Work /
--                        Move-In Ready (step 2 toggle; also written
--                        into the notes "Repairs needed:" line, the
--                        same wording the old repairs select used,
--                        so stored data stays compatible).
--      occupancy      — Owner-Occupied / Tenant / Vacant.
--      timeline       — ASAP / 30 Days / Just Exploring (replaces
--                        the old "how soon" select; also written
--                        into the notes "Timeline:" line).
--    Consent already has columns (consent_status, consent_at,
--    consent_source — schema v4.1); asking_price already exists
--    (schema v5.1); photos already live in lead_photos + the
--    private lead-photos bucket (schema v5.2) — none of those are
--    recreated here.
-- ----------------------------------------------------------------------------
alter table public.leads
  add column if not exists is_partial boolean not null default false;
alter table public.leads
  add column if not exists property_type text;
alter table public.leads
  add column if not exists condition text;
alter table public.leads
  add column if not exists occupancy text;
alter table public.leads
  add column if not exists timeline text;

-- ----------------------------------------------------------------------------
-- 3. Seller-lead functions. The public seller form and the voice
--    intake already write leads through server-side paths
--    (submit_seller_lead RPC, /api/intake) because anonymous
--    visitors cannot write the leads table under RLS. These two
--    functions extend that same pattern for the two-step form —
--    they do NOT replace the existing paths, and the voice intake
--    is untouched.
--
--    submit_seller_lead_v2 — step 1 (and any full submission):
--    calls the existing submit_seller_lead with its exact ten
--    parameters, then patches the new columns on the row it just
--    created. Returns the lead id, or null on failure, exactly
--    like the original. New parameters all have defaults, so a
--    call with only the original ten behaves identically to the
--    original. Consent is only upgraded when the seller checked
--    the call/text box: 'express_consent' with the time and the
--    source stamped; otherwise the original function's consent
--    value stands.
--
--    complete_seller_lead — step 2: the seller finishes the
--    details for a lead step 1 just created. It re-verifies the
--    page (slug resolves to an enabled, unsuspended seller page),
--    the lead (belongs to that page's owner, source 'Seller
--    landing page', created within the last 2 hours — the same
--    freshness window the seller-photo route uses), then writes
--    the step-2 details, replaces the notes with the complete
--    version the page composed, and clears is_partial. Returns
--    true when the update landed, false otherwise.
-- ----------------------------------------------------------------------------
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
  p_asking_price numeric default null
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
         consent_status = case when p_consent then 'express_consent' else consent_status end,
         consent_at = case when p_consent then now() else consent_at end,
         consent_source = case when p_consent then 'Seller page (call/text consent)' else consent_source end
   where id = v_id::uuid;
  return v_id;
end;
$$;

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
  p_notes text
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
         is_partial = false
   where id = p_lead_id::uuid;
  return found;
end;
$$;

-- Rollback (only if this migration itself must be undone):
--   drop function if exists public.complete_seller_lead(text, text, text, text, text, text, text, text, text, numeric, text);
--   drop function if exists public.submit_seller_lead_v2(text, text, text, text, text, text, text, text, text, text, boolean, boolean, text, text, text, text, numeric);
--   alter table public.leads drop column if exists is_partial;
--   alter table public.leads drop column if exists property_type;
--   alter table public.leads drop column if exists condition;
--   alter table public.leads drop column if exists occupancy;
--   alter table public.leads drop column if exists timeline;
--   drop table if exists public.storefront_profiles;
