-- ============================================================================
-- WholesalingOS — Win-Win Ecosystem, Slice 122: scout leads, vendor
-- marketplace, JV deal room, mail credits, school progress, seller
-- advance requests.
-- Migration file ONLY. NOT APPLIED. NOT LIVE.
--
-- Run this in the Supabase SQL editor (owner step) against the project
-- that already ran 20261115090000_capital_lending_lender_role.sql and
-- 20261115091500_capital_lending_fee_exact.sql. Do NOT run it against
-- any other project. It is written to be idempotent: re-running it
-- after a successful run changes nothing. No secrets, keys, vendors,
-- scouts, leads, partners, or deals are created by this file.
-- Nothing here touches leads, seller contacts, or assignment fees:
-- those live in other tables under their own policies, and no policy
-- below can ever expose them.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Role helper. is_operator() already lives in the Capital & Lending
--    migration; is_wholesaler() mirrors it so the scout-browse and
--    JV-room policies do not depend on the caller being able to read
--    profiles rows directly. Both are SECURITY DEFINER and return a
--    boolean only.
-- ----------------------------------------------------------------------------
create or replace function public.is_wholesaler()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'wholesaler'
  );
$$;

-- ----------------------------------------------------------------------------
-- 1. scout_leads — Mobile "Drive-for-Dollars" scout submissions.
--    A scout snaps a photo of a vacant/distressed property and the
--    platform tracks it to a $1,000 payout at the closing table.
--    payout_amount defaults to 1000.00 (the platform's stated scout
--    payout). Photos live in the private 'scout-photos' bucket under
--    <scout_id>/<lead_id>/<file>; this table stores only the paths.
--    updated_at is maintained by the existing set_updated_at() trigger
--    function from the Capital & Lending migration.
-- ----------------------------------------------------------------------------
create table if not exists public.scout_leads (
  id uuid primary key default gen_random_uuid(),
  scout_id uuid not null references public.profiles (id) on delete cascade,
  property_address text not null,
  city text,
  state text default 'FL',
  zip_code text,
  distress_tags text[] not null default '{}',
  photo_urls text[] not null default '{}',
  seller_notes text,
  claimed_by_wholesaler_id uuid references public.profiles (id) on delete set null,
  status text not null default 'submitted'
    check (status in ('submitted', 'claimed_reviewing', 'under_contract', 'in_escrow', 'closed_paid_1000', 'passed')),
  payout_amount numeric not null default 1000.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scout_leads_scout_idx
  on public.scout_leads (scout_id);
create index if not exists scout_leads_claimed_by_idx
  on public.scout_leads (claimed_by_wholesaler_id);
create index if not exists scout_leads_status_idx
  on public.scout_leads (status);

drop trigger if exists scout_leads_updated_at on public.scout_leads;
create trigger scout_leads_updated_at
  before update on public.scout_leads
  for each row execute function public.set_updated_at();

alter table public.scout_leads enable row level security;

-- Scouts see and manage their own submissions. A scout may edit or
-- delete their row only while it is still unclaimed (with check
-- requires claimed_by to stay NULL), so a scout can never un-claim
-- a lead or take it back from the wholesaler working it.
drop policy if exists "scout manages own submissions" on public.scout_leads;
create policy "scout manages own submissions"
  on public.scout_leads
  for all
  to authenticated
  using (scout_id = auth.uid() and claimed_by_wholesaler_id is null)
  with check (scout_id = auth.uid() and claimed_by_wholesaler_id is null);

-- A scout always reads their own rows, claimed or not, to track the
-- status progression to payout.
drop policy if exists "scout reads own submissions" on public.scout_leads;
create policy "scout reads own submissions"
  on public.scout_leads
  for select
  to authenticated
  using (scout_id = auth.uid());

-- Wholesalers browse unclaimed 'submitted' leads (address, photos,
-- notes) so they can claim one into their sealed office.
drop policy if exists "wholesalers browse unclaimed scout leads" on public.scout_leads;
create policy "wholesalers browse unclaimed scout leads"
  on public.scout_leads
  for select
  to authenticated
  using (
    claimed_by_wholesaler_id is null
    and status = 'submitted'
    and public.is_wholesaler()
  );

-- Once claimed, only that wholesaler (plus the scout and operator)
-- can see the status progression.
drop policy if exists "claiming wholesaler reads claimed lead" on public.scout_leads;
create policy "claiming wholesaler reads claimed lead"
  on public.scout_leads
  for select
  to authenticated
  using (claimed_by_wholesaler_id = auth.uid());

-- Claiming: a wholesaler claims an unclaimed 'submitted' row into
-- their own office. The with check pins the claim to themselves and
-- the first status step — a claim cannot land on another account.
drop policy if exists "wholesaler claims unclaimed scout lead" on public.scout_leads;
create policy "wholesaler claims unclaimed scout lead"
  on public.scout_leads
  for update
  to authenticated
  using (
    claimed_by_wholesaler_id is null
    and status = 'submitted'
    and public.is_wholesaler()
  )
  with check (
    claimed_by_wholesaler_id = auth.uid()
    and status = 'claimed_reviewing'
  );

-- The claiming wholesaler advances the status (under_contract,
-- in_escrow, closed_paid_1000, passed). RLS cannot limit an update
-- to one column, so the UI is the only thing that offers the status
-- control — the same limitation the funding_requests policies carry
-- and state. The status CHECK still refuses any other value.
drop policy if exists "claiming wholesaler advances scout lead" on public.scout_leads;
create policy "claiming wholesaler advances scout lead"
  on public.scout_leads
  for update
  to authenticated
  using (claimed_by_wholesaler_id = auth.uid())
  with check (claimed_by_wholesaler_id = auth.uid());

-- Operator reads and manages every scout lead (including marking a
-- lead closed_paid_1000 when the $1,000 is paid at the closing table).
drop policy if exists "operator reads all scout leads" on public.scout_leads;
create policy "operator reads all scout leads"
  on public.scout_leads
  for select
  to authenticated
  using (public.is_operator());

drop policy if exists "operator manages scout leads" on public.scout_leads;
create policy "operator manages scout leads"
  on public.scout_leads
  for update
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());

drop policy if exists "operator deletes scout leads" on public.scout_leads;
create policy "operator deletes scout leads"
  on public.scout_leads
  for delete
  to authenticated
  using (public.is_operator());

-- ----------------------------------------------------------------------------
-- 1b. Private 'scout-photos' Storage bucket + policies.
--    Idempotent: the bucket insert is ON CONFLICT DO NOTHING and the
--    policies are dropped before creation. A scout uploads only under
--    their own user id (<scout_id>/<lead_id>/<file>); the claiming
--    wholesaler reads photos of leads they claimed; the operator reads
--    all. No public access: the bucket is private and every display
--    URL is a short-lived signed URL. If the bucket row already exists
--    from an earlier run, nothing changes.
--    NOTE (owner): after applying, confirm in the dashboard that the
--    bucket 'scout-photos' exists and is private — storage policies
--    cannot be exercised from this repo.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('scout-photos', 'scout-photos', false)
on conflict (id) do nothing;

drop policy if exists "scout uploads own scout photos" on storage.objects;
create policy "scout uploads own scout photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'scout-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "scout reads own scout photos" on storage.objects;
create policy "scout reads own scout photos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'scout-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "claiming wholesaler reads claimed scout photos" on storage.objects;
create policy "claiming wholesaler reads claimed scout photos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'scout-photos'
    and exists (
      select 1 from public.scout_leads sl
      where sl.claimed_by_wholesaler_id = auth.uid()
        and sl.scout_id::text = (storage.foldername(name))[1]
        and sl.id::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists "operator reads all scout photos" on storage.objects;
create policy "operator reads all scout photos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'scout-photos'
    and public.is_operator()
  );

-- ----------------------------------------------------------------------------
-- 2. vendor_directory — Rehab & Property Services Vendor Directory.
--    Licensed contractors, roofers, inspectors, cleanout crews,
--    appraisers, and property managers register here. Listing is
--    FREE while the directory launches: subscription_status is a
--    status field only — the platform charges no subscription in
--    this slice, and the operator flips the field by hand. A vendor
--    is visible to requesters only after the operator verifies them.
--    Verification cannot be self-granted: the trigger below refuses
--    any change to is_verified or subscription_status by anyone
--    except the operator.
-- ----------------------------------------------------------------------------
create table if not exists public.vendor_directory (
  id uuid primary key default gen_random_uuid(),
  vendor_user_id uuid not null references public.profiles (id) on delete cascade,
  business_name text,
  trade_category text
    check (trade_category in ('general_contractor', 'roofing', 'home_inspector', 'cleanout_crew', 'appraiser', 'property_manager')),
  license_number text not null,
  states_covered text[] not null default '{}',
  counties_covered text[] not null default '{}',
  subscription_status text not null default 'inactive'
    check (subscription_status in ('active', 'inactive')),
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (vendor_user_id)
);

create index if not exists vendor_directory_user_idx
  on public.vendor_directory (vendor_user_id);
create index if not exists vendor_directory_trade_idx
  on public.vendor_directory (trade_category, is_verified);

alter table public.vendor_directory enable row level security;

-- A vendor manages only their own row — except verification and
-- subscription status, which the trigger below reserves to the
-- operator. The with check keeps the row on their own account.
drop policy if exists "vendor manages own directory row" on public.vendor_directory;
create policy "vendor manages own directory row"
  on public.vendor_directory
  for all
  to authenticated
  using (vendor_user_id = auth.uid())
  with check (vendor_user_id = auth.uid());

-- Requesters read only verified vendors. An unverified or inactive
-- listing is invisible to them.
drop policy if exists "requesters read verified vendors" on public.vendor_directory;
create policy "requesters read verified vendors"
  on public.vendor_directory
  for select
  to authenticated
  using (is_verified = true);

-- Operator reads all vendor rows.
drop policy if exists "operator reads all vendor rows" on public.vendor_directory;
create policy "operator reads all vendor rows"
  on public.vendor_directory
  for select
  to authenticated
  using (public.is_operator());

-- Operator flips verification and subscription status.
drop policy if exists "operator verifies vendor rows" on public.vendor_directory;
create policy "operator verifies vendor rows"
  on public.vendor_directory
  for update
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());

-- Verification guard: is_verified and subscription_status may change
-- only when the operator makes the change. A vendor who tries to
-- verify themselves gets an error, not a verified badge.
create or replace function public.enforce_vendor_verification()
returns trigger
language plpgsql
as $$
begin
  if (old.is_verified is distinct from new.is_verified
      or old.subscription_status is distinct from new.subscription_status)
     and not public.is_operator() then
    raise exception 'Only the operator can change vendor verification or subscription status.';
  end if;
  return new;
end;
$$;

drop trigger if exists vendor_directory_verification_guard on public.vendor_directory;
create trigger vendor_directory_verification_guard
  before update on public.vendor_directory
  for each row execute function public.enforce_vendor_verification();

-- ----------------------------------------------------------------------------
-- 3. vendor_bid_requests — opt-in bid requests to ONE chosen vendor.
--    vendor_id is the vendor this request was sent to (the modal sends
--    to one chosen verified vendor, never a broadcast). It is not in
--    the original column list because the request form names the
--    vendor by trade + state; the column exists so RLS can tell the
--    chosen vendor apart from every other vendor. deal_id is
--    intentionally NOT a foreign key: a request may exist before its
--    deal row, and a deleted deal must not delete the request.
-- ----------------------------------------------------------------------------
create table if not exists public.vendor_bid_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  vendor_id uuid references public.vendor_directory (id) on delete set null,
  deal_id uuid,
  property_address text,
  property_state text,
  trade_needed text
    check (trade_needed in ('general_contractor', 'roofing', 'home_inspector', 'cleanout_crew', 'appraiser', 'property_manager')),
  scope_notes text,
  target_walkthrough_date date,
  status text not null default 'open'
    check (status in ('open', 'bids_received', 'awarded')),
  created_at timestamptz not null default now()
);

create index if not exists vendor_bid_requests_requester_idx
  on public.vendor_bid_requests (requester_id);
create index if not exists vendor_bid_requests_vendor_idx
  on public.vendor_bid_requests (vendor_id);
create index if not exists vendor_bid_requests_status_idx
  on public.vendor_bid_requests (status);

alter table public.vendor_bid_requests enable row level security;

-- Requester manages their own bid requests.
drop policy if exists "requester manages own bid requests" on public.vendor_bid_requests;
create policy "requester manages own bid requests"
  on public.vendor_bid_requests
  for all
  to authenticated
  using (requester_id = auth.uid())
  with check (requester_id = auth.uid());

-- The chosen vendor reads the requests sent to them — and only those.
drop policy if exists "chosen vendor reads bid requests" on public.vendor_bid_requests;
create policy "chosen vendor reads bid requests"
  on public.vendor_bid_requests
  for select
  to authenticated
  using (
    exists (
      select 1 from public.vendor_directory vd
      where vd.id = vendor_bid_requests.vendor_id
        and vd.vendor_user_id = auth.uid()
    )
  );

-- The chosen vendor moves the request's status (bids_received,
-- awarded). Same one-column limitation as funding_requests: the UI
-- offers only the status control.
drop policy if exists "chosen vendor updates bid request status" on public.vendor_bid_requests;
create policy "chosen vendor updates bid request status"
  on public.vendor_bid_requests
  for update
  to authenticated
  using (
    exists (
      select 1 from public.vendor_directory vd
      where vd.id = vendor_bid_requests.vendor_id
        and vd.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.vendor_directory vd
      where vd.id = vendor_bid_requests.vendor_id
        and vd.vendor_user_id = auth.uid()
    )
  );

-- Operator reads all bid requests.
drop policy if exists "operator reads all bid requests" on public.vendor_bid_requests;
create policy "operator reads all bid requests"
  on public.vendor_bid_requests
  for select
  to authenticated
  using (public.is_operator());

-- ----------------------------------------------------------------------------
-- 4. jv_listings — Joint Venture & Co-Wholesaling Deal Room.
--    Deliberately narrow: this table holds NO exact street address
--    and NO seller contact, by design — those are shared only after
--    a JV match, outside this table. A listing is city/state/type/
--    prices/split/summary only.
-- ----------------------------------------------------------------------------
create table if not exists public.jv_listings (
  id uuid primary key default gen_random_uuid(),
  originating_wholesaler_id uuid not null references public.profiles (id) on delete cascade,
  property_city text,
  property_state text,
  property_type text
    check (property_type in ('house', 'land', 'multifamily')),
  contract_price numeric,
  estimated_arv numeric,
  estimated_repairs numeric,
  proposed_jv_split_percent numeric not null default 50,
  deal_summary text,
  status text not null default 'open'
    check (status in ('open', 'partnered', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists jv_listings_originator_idx
  on public.jv_listings (originating_wholesaler_id);
create index if not exists jv_listings_status_idx
  on public.jv_listings (status);

alter table public.jv_listings enable row level security;

-- Any signed-in wholesaler can browse OPEN listings.
drop policy if exists "wholesalers browse open jv listings" on public.jv_listings;
create policy "wholesalers browse open jv listings"
  on public.jv_listings
  for select
  to authenticated
  using (status = 'open' and public.is_wholesaler());

-- The originator always reads their own listings, open or not.
drop policy if exists "originator reads own jv listings" on public.jv_listings;
create policy "originator reads own jv listings"
  on public.jv_listings
  for select
  to authenticated
  using (originating_wholesaler_id = auth.uid());

-- A partner whose interest was accepted reads the partnered listing.
drop policy if exists "accepted partner reads partnered listing" on public.jv_listings;
create policy "accepted partner reads partnered listing"
  on public.jv_listings
  for select
  to authenticated
  using (
    status = 'partnered'
    and exists (
      select 1 from public.jv_interests ji
      where ji.jv_listing_id = jv_listings.id
        and ji.wholesaler_id = auth.uid()
        and ji.status = 'accepted'
    )
  );

-- Originator manages their own listings (post, close, reopen, delete).
drop policy if exists "originator manages own jv listings" on public.jv_listings;
create policy "originator manages own jv listings"
  on public.jv_listings
  for all
  to authenticated
  using (originating_wholesaler_id = auth.uid())
  with check (originating_wholesaler_id = auth.uid() and public.is_wholesaler());

-- Operator reads all JV listings.
drop policy if exists "operator reads all jv listings" on public.jv_listings;
create policy "operator reads all jv listings"
  on public.jv_listings
  for select
  to authenticated
  using (public.is_operator());

-- ----------------------------------------------------------------------------
-- 4b. jv_interests — mutual opt-in for the JV Deal Room.
--    A wholesaler expresses interest in a listing; the originator
--    accepts or declines. Contact is exchanged only after BOTH opt
--    in: the interested wholesaler shares their email by expressing
--    interest (wholesaler_email, written by them), and the originator
--    shares theirs by accepting (originator_email, written by them
--    at acceptance). Before acceptance, the interested party sees
--    "waiting for the originator" and the originator sees only that
--    someone is interested — no contact either way. One interest per
--    wholesaler per listing.
-- ----------------------------------------------------------------------------
create table if not exists public.jv_interests (
  id uuid primary key default gen_random_uuid(),
  jv_listing_id uuid not null references public.jv_listings (id) on delete cascade,
  wholesaler_id uuid not null references public.profiles (id) on delete cascade,
  wholesaler_email text,
  originator_email text,
  message text,
  status text not null default 'interested'
    check (status in ('interested', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (jv_listing_id, wholesaler_id)
);

create index if not exists jv_interests_listing_idx
  on public.jv_interests (jv_listing_id);
create index if not exists jv_interests_wholesaler_idx
  on public.jv_interests (wholesaler_id);

alter table public.jv_interests enable row level security;

-- The interested wholesaler records their own interest.
drop policy if exists "wholesaler records own jv interest" on public.jv_interests;
create policy "wholesaler records own jv interest"
  on public.jv_interests
  for insert
  to authenticated
  with check (wholesaler_id = auth.uid() and public.is_wholesaler());

-- The interested wholesaler reads their own interest rows.
drop policy if exists "wholesaler reads own jv interest" on public.jv_interests;
create policy "wholesaler reads own jv interest"
  on public.jv_interests
  for select
  to authenticated
  using (wholesaler_id = auth.uid());

-- The listing originator reads interests on their listings.
drop policy if exists "originator reads interests on own listings" on public.jv_interests;
create policy "originator reads interests on own listings"
  on public.jv_interests
  for select
  to authenticated
  using (
    exists (
      select 1 from public.jv_listings jl
      where jl.id = jv_interests.jv_listing_id
        and jl.originating_wholesaler_id = auth.uid()
    )
  );

-- The originator accepts or declines an interest (and, on acceptance,
-- writes their own email into originator_email — the second opt-in).
drop policy if exists "originator answers jv interest" on public.jv_interests;
create policy "originator answers jv interest"
  on public.jv_interests
  for update
  to authenticated
  using (
    exists (
      select 1 from public.jv_listings jl
      where jl.id = jv_interests.jv_listing_id
        and jl.originating_wholesaler_id = auth.uid()
    )
  )
  with check (
    status in ('accepted', 'declined')
    and exists (
      select 1 from public.jv_listings jl
      where jl.id = jv_interests.jv_listing_id
        and jl.originating_wholesaler_id = auth.uid()
    )
  );

-- The interested wholesaler may withdraw (delete) their own interest
-- while it is still only 'interested'.
drop policy if exists "wholesaler withdraws own jv interest" on public.jv_interests;
create policy "wholesaler withdraws own jv interest"
  on public.jv_interests
  for delete
  to authenticated
  using (wholesaler_id = auth.uid() and status = 'interested');

-- Operator reads all JV interests.
drop policy if exists "operator reads all jv interests" on public.jv_interests;
create policy "operator reads all jv interests"
  on public.jv_interests
  for select
  to authenticated
  using (public.is_operator());

-- ----------------------------------------------------------------------------
-- 5. mail_credits_ledger — Direct Mail Credits.
--    Append-only by design: a user's balance is SUM(credits_delta)
--    over their own rows. No update or delete policy exists at all,
--    so a credit row, once written, cannot be rewritten or removed
--    through the API. Credits are NOT charged in this slice: mail
--    sending is not wired to any print provider, so no row is ever
--    written with a negative delta by the app until sending is live.
-- ----------------------------------------------------------------------------
create table if not exists public.mail_credits_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  credits_delta integer not null,
  unit_price_paid numeric,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists mail_credits_ledger_user_idx
  on public.mail_credits_ledger (user_id);

alter table public.mail_credits_ledger enable row level security;

-- A user reads only their own credit rows.
drop policy if exists "user reads own mail credits" on public.mail_credits_ledger;
create policy "user reads own mail credits"
  on public.mail_credits_ledger
  for select
  to authenticated
  using (user_id = auth.uid());

-- A user may insert only their own rows (a purchase records here).
drop policy if exists "user inserts own mail credits" on public.mail_credits_ledger;
create policy "user inserts own mail credits"
  on public.mail_credits_ledger
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Operator reads all credit rows.
drop policy if exists "operator reads all mail credits" on public.mail_credits_ledger;
create policy "operator reads all mail credits"
  on public.mail_credits_ledger
  for select
  to authenticated
  using (public.is_operator());

-- ----------------------------------------------------------------------------
-- 6. school_progress — WholesalingOS School 7-Day Bootcamp progress.
--    One row per user per day (1..7). completed_at is stamped when
--    the day is finished; verified_operator_badge is set true only on
--    the day-7 row when the Day 7 quiz is passed. The badge means
--    exactly "completed the 7-day bootcamp and passed the Day 7
--    check" — never a license or regulatory certification.
-- ----------------------------------------------------------------------------
create table if not exists public.school_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  day_number integer not null
    check (day_number between 1 and 7),
  completed_at timestamptz,
  verified_operator_badge boolean not null default false,
  unique (user_id, day_number)
);

create index if not exists school_progress_user_idx
  on public.school_progress (user_id);

alter table public.school_progress enable row level security;

-- A user manages only their own progress rows.
drop policy if exists "user manages own school progress" on public.school_progress;
create policy "user manages own school progress"
  on public.school_progress
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Operator reads all progress rows.
drop policy if exists "operator reads all school progress" on public.school_progress;
create policy "operator reads all school progress"
  on public.school_progress
  for select
  to authenticated
  using (public.is_operator());

-- Badge lookup for other users' listings: a signed-in user may ask
-- only whether a given account completed the bootcamp — a boolean,
-- never the progress rows themselves. Used to show the ✓ Verified
-- Operator badge on JV Deal Room listings.
create or replace function public.is_verified_operator(p_user uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.school_progress
    where user_id = p_user
      and day_number = 7
      and verified_operator_badge = true
  );
$$;

-- ----------------------------------------------------------------------------
-- 7. seller_advance_requests — Fast-Cash Seller Moving Advance.
--    A REQUEST for operator review only. No advance is promised or
--    guaranteed by this row, and no money moves through the platform:
--    the operator reviews the request, and any advance is agreed
--    outside this table, repaid out of closing proceeds. Amount is
--    constrained to the $1,500–$3,000 range from the request form.
-- ----------------------------------------------------------------------------
create table if not exists public.seller_advance_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  deal_id uuid,
  amount_requested numeric not null
    check (amount_requested >= 1500 and amount_requested <= 3000),
  seller_name text,
  reason text,
  status text not null default 'requested'
    check (status in ('requested', 'under_review', 'approved', 'declined', 'repaid')),
  created_at timestamptz not null default now()
);

create index if not exists seller_advance_requests_requester_idx
  on public.seller_advance_requests (requester_id);
create index if not exists seller_advance_requests_status_idx
  on public.seller_advance_requests (status);

alter table public.seller_advance_requests enable row level security;

-- Requester manages (reads) their own advance requests.
drop policy if exists "requester reads own advance requests" on public.seller_advance_requests;
create policy "requester reads own advance requests"
  on public.seller_advance_requests
  for select
  to authenticated
  using (requester_id = auth.uid());

drop policy if exists "requester inserts own advance request" on public.seller_advance_requests;
create policy "requester inserts own advance request"
  on public.seller_advance_requests
  for insert
  to authenticated
  with check (requester_id = auth.uid());

-- Operator reads all advance requests and moves them through review.
drop policy if exists "operator reads all advance requests" on public.seller_advance_requests;
create policy "operator reads all advance requests"
  on public.seller_advance_requests
  for select
  to authenticated
  using (public.is_operator());

drop policy if exists "operator updates advance requests" on public.seller_advance_requests;
create policy "operator updates advance requests"
  on public.seller_advance_requests
  for update
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());

-- ----------------------------------------------------------------------------
-- 8. Verification (run by hand AFTER applying, as the owner, in the
--    Supabase SQL editor — these are commented out on purpose).
-- ----------------------------------------------------------------------------
-- -- Tables + RLS on:
-- -- select tablename, rowsecurity from pg_tables
-- --   where schemaname = 'public'
-- --   and tablename in ('scout_leads', 'vendor_directory',
-- --     'vendor_bid_requests', 'jv_listings', 'jv_interests',
-- --     'mail_credits_ledger', 'school_progress',
-- --     'seller_advance_requests');
-- --
-- -- Bucket exists and is private:
-- -- select id, public from storage.buckets where id = 'scout-photos';
-- --
-- -- Vendor self-verification is refused:
-- -- update public.vendor_directory set is_verified = true
-- --   where vendor_user_id = '<your own user id>';
-- --   -- must fail: the verification guard trigger refuses it.
-- --
-- -- A scout cannot see another scout's lead:
-- -- (sign in as a second scout and confirm the first scout's
-- --  unclaimed lead does not appear in their tracker.)
-- --
-- -- A JV listing carries no street address or seller contact:
-- -- select * from public.jv_listings; -- no such columns exist.
--
-- ----------------------------------------------------------------------------
-- 9. Rollback note (owner only, after a backup).
--    drop table if exists public.seller_advance_requests;
--    drop table if exists public.school_progress;
--    drop table if exists public.mail_credits_ledger;
--    drop table if exists public.jv_interests;
--    drop table if exists public.jv_listings;
--    drop table if exists public.vendor_bid_requests;
--    drop table if exists public.vendor_directory;
--    drop table if exists public.scout_leads;
--    drop function if exists public.is_verified_operator(uuid);
--    drop function if exists public.is_wholesaler();
--    drop function if exists public.enforce_vendor_verification();
--    -- The scout-photos bucket is left in place on rollback (photos
--    -- are user data); delete it from Storage settings if truly
--    -- unwanted. There is no automatic rollback of rows already
--    -- written.
-- ----------------------------------------------------------------------------
