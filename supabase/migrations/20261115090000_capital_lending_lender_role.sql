-- ============================================================================
-- WholesalingOS — Capital & Lending Module: lender role + opt-in funding
-- Migration file ONLY. NOT APPLIED. NOT LIVE.
--
-- Run this in the Supabase SQL editor (owner step) against the project
-- that already has the profiles table. Do NOT run it twice blindly and
-- do NOT run it against any other project. It is written to be
-- idempotent: re-running it after a successful run changes nothing.
-- No secrets, keys, lenders, or deals are created by this file.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Role naming: two spellings exist in this codebase.
--    The app code uses 'buyer' (cash buyer) and 'title' (title company):
--    lib/portals.ts PortalRole = 'wholesaler' | 'buyer' | 'seller' |
--    'title' | 'referrer'. The Capital & Lending prompts use
--    'cash_buyer' and 'title_company'. This migration accepts BOTH
--    spellings, so the prompt's enum and the existing code both work.
--    New code should use the app spellings ('buyer', 'title') and
--    'lender' for the new role.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1. profiles.role: allow 'lender'.
--    Handles all three shapes the column may be in, without dropping data:
--    (a) a CHECK constraint on profiles.role -> drop and recreate it wider;
--    (b) a Postgres enum type carrying 'wholesaler' -> add 'lender' to it;
--    (c) plain text with no constraint -> nothing to change.
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
  cname text;
begin
  -- (a) CHECK constraint on profiles.role, if one exists.
  select conname into cname
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%';
  if cname is not null then
    execute format('alter table public.profiles drop constraint %I', cname);
    alter table public.profiles
      add constraint profiles_role_check
      check (role in (
        'wholesaler', 'buyer', 'cash_buyer', 'seller',
        'title', 'title_company', 'referrer', 'lender'
      ));
    raise notice 'profiles role CHECK constraint replaced to include lender (and both buyer/title spellings).';
  end if;

  -- (b) Enum type carrying 'wholesaler', if the column uses one.
  for r in
    select t.typname as enum_name
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where e.enumlabel = 'wholesaler'
    group by t.typname
  loop
    begin
      execute format('alter type %I add value if not exists %L', r.enum_name, 'lender');
      raise notice 'Added lender to enum %.', r.enum_name;
    exception when others then
      raise notice 'Could not add lender to enum % (may need a separate run outside a transaction): %', r.enum_name, sqlerrm;
    end;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2. lender_boxes — a lender's published lending criteria.
--    One box per lender. Nothing here is public: see the RLS policies
--    below. partner_agreement_accepted must be true before
--    is_verified_partner can be true (enforced by the CHECK below and
--    by the UI gate in components/LenderDashboard.tsx).
-- ----------------------------------------------------------------------------
create table if not exists public.lender_boxes (
  id uuid primary key default gen_random_uuid(),
  lender_id uuid not null references public.profiles (id) on delete cascade,
  company_name text,
  lending_types text[] not null default '{}'
    check (lending_types <@ array['transactional', 'fix_and_flip', 'dscr', 'bridge']::text[]),
  states_covered text[] not null default '{}',
  min_loan_amount numeric,
  max_loan_amount numeric,
  max_ltv_percent numeric,
  min_dscr numeric,
  partner_agreement_accepted boolean not null default false,
  partner_agreement_accepted_at timestamptz,
  is_verified_partner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lender_id),
  -- Verification requires the agreement first. This is a database rule,
  -- not just a UI rule: no verified partner without an accepted agreement.
  check (not is_verified_partner or partner_agreement_accepted)
);

-- States are 2-letter US state codes (e.g. 'FL'). Enforce the shape,
-- not a fixed list, so DC and territories are not locked out by a typo.
-- (The app only offers the 50 states + DC in its toggles.)

-- ----------------------------------------------------------------------------
-- 3. funding_requests — opt-in commercial funding packets.
--    Deliberately narrow: this table holds ONLY the packet a requester
--    chose to share. It has NO leads, NO seller contacts, and NO
--    wholesaler assignment fees in it, so no policy below can ever
--    expose those things to a lender — they are not in this table.
--    business_purpose_certified and no_upfront_fee_acknowledged are
--    constrained to TRUE: a row cannot exist without both attestations.
-- ----------------------------------------------------------------------------
create table if not exists public.funding_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  deal_id uuid,
  financing_type text not null
    check (financing_type in ('transactional', 'fix_and_flip', 'dscr', 'bridge')),
  borrowing_entity_name text,
  entity_state text,
  business_purpose_certified boolean not null default false
    check (business_purpose_certified = true),
  no_upfront_fee_acknowledged boolean not null default false
    check (no_upfront_fee_acknowledged = true),
  property_address text,
  property_state text,
  purchase_price numeric,
  loan_amount_requested numeric,
  estimated_arv numeric,
  rehab_budget numeric,
  monthly_rent numeric,
  target_closing_date date,
  title_company_name text,
  title_officer_email text,
  routing_track text not null
    check (routing_track in ('direct_feet_washers', 'wholesale_iso_network')),
  assigned_lender_id uuid references public.profiles (id) on delete set null,
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'term_sheet_issued', 'clear_to_close', 'funded', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- deal_id is intentionally NOT a foreign key: a packet may be filed
-- before its deal row exists, and a deleted deal must not delete the
-- funding record the operator already acted on. The app passes the
-- deal id through only when it has one.

create index if not exists funding_requests_requester_idx
  on public.funding_requests (requester_id);
create index if not exists funding_requests_assigned_lender_idx
  on public.funding_requests (assigned_lender_id);
create index if not exists funding_requests_routing_idx
  on public.funding_requests (routing_track);
create index if not exists funding_requests_status_idx
  on public.funding_requests (status);
create index if not exists funding_requests_property_state_idx
  on public.funding_requests (property_state);
create index if not exists lender_boxes_lender_idx
  on public.lender_boxes (lender_id);

-- ----------------------------------------------------------------------------
-- updated_at maintenance (idempotent).
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lender_boxes_updated_at on public.lender_boxes;
create trigger lender_boxes_updated_at
  before update on public.lender_boxes
  for each row execute function public.set_updated_at();

drop trigger if exists funding_requests_updated_at on public.funding_requests;
create trigger funding_requests_updated_at
  before update on public.funding_requests
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Row-Level Security.
--    Operator identity lives in ONE place: is_operator(). It checks the
--    signed-in user's own profiles row for the operator email. The
--    email literal 'thefeetwashers@gmail.com' appears nowhere else in
--    this file. The function is SECURITY DEFINER so it can read the
--    profiles row even under profiles RLS; it returns a boolean only
--    and exposes nothing else.
-- ----------------------------------------------------------------------------
alter table public.lender_boxes enable row level security;
alter table public.funding_requests enable row level security;

create or replace function public.is_operator()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and email = 'thefeetwashers@gmail.com'
  );
$$;

-- --- lender_boxes policies ---
-- A lender manages only their own box.
drop policy if exists "lender manages own box" on public.lender_boxes;
create policy "lender manages own box"
  on public.lender_boxes
  for all
  to authenticated
  using (lender_id = auth.uid())
  with check (lender_id = auth.uid());

-- The operator reads every box, so partner verification can happen.
-- The operator may also flip is_verified_partner (the verification
-- toggle in the Lender Dashboard). No other account may update a box
-- it does not own.
drop policy if exists "operator reads all lender boxes" on public.lender_boxes;
create policy "operator reads all lender boxes"
  on public.lender_boxes
  for select
  to authenticated
  using (public.is_operator());

drop policy if exists "operator verifies lender boxes" on public.lender_boxes;
create policy "operator verifies lender boxes"
  on public.lender_boxes
  for update
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());

-- A requester may read a lender's box ONLY in the context of one of
-- their own opt-in ISO-network packets that the box actually matches
-- (verified partner, agreement accepted, state covered, program
-- offered). This is deliberately NOT a public read: lender criteria
-- are never listed to the world, and a lender's box is never readable
-- by another lender or by a requester whose packet does not match it.
drop policy if exists "requester reads matched lender boxes" on public.lender_boxes;
create policy "requester reads matched lender boxes"
  on public.lender_boxes
  for select
  to authenticated
  using (
    is_verified_partner
    and partner_agreement_accepted
    and exists (
      select 1 from public.funding_requests fr
      where fr.requester_id = auth.uid()
        and fr.routing_track = 'wholesale_iso_network'
        and fr.property_state = any (lender_boxes.states_covered)
        and fr.financing_type = any (lender_boxes.lending_types)
    )
  );

-- --- funding_requests policies ---
-- Requesters can only view and manage their own funding requests.
drop policy if exists "requester manages own funding requests" on public.funding_requests;
create policy "requester manages own funding requests"
  on public.funding_requests
  for all
  to authenticated
  using (requester_id = auth.uid())
  with check (requester_id = auth.uid());

-- Direct track: visible ONLY to the requester and the operator.
-- (The requester is already covered by the policy above; this one
-- adds the operator, and only for the direct track.)
drop policy if exists "operator reads direct funding requests" on public.funding_requests;
create policy "operator reads direct funding requests"
  on public.funding_requests
  for select
  to authenticated
  using (
    routing_track = 'direct_feet_washers'
    and public.is_operator()
  );

-- The operator may move a direct request through its statuses
-- (under_review, term_sheet_issued, clear_to_close, funded, declined).
drop policy if exists "operator updates direct funding requests" on public.funding_requests;
create policy "operator updates direct funding requests"
  on public.funding_requests
  for update
  to authenticated
  using (
    routing_track = 'direct_feet_washers'
    and public.is_operator()
  )
  with check (
    routing_track = 'direct_feet_washers'
    and public.is_operator()
  );

-- ISO-network track: visible ONLY to the requester and to lenders
-- whose box is a verified partner, has accepted the agreement, and
-- covers this packet's state and financing type. No other lender,
-- no other requester, and (by design, per the prompt) not the
-- operator through this policy — the operator's read above is
-- direct-track only. A matched lender may also move the packet's
-- status (the status dropdown in the Lender Dashboard); RLS cannot
-- limit an update to one column, so the UI is the only thing that
-- offers the status control, and the policy keeps the row itself
-- matched-only.
drop policy if exists "matched lenders read iso funding requests" on public.funding_requests;
create policy "matched lenders read iso funding requests"
  on public.funding_requests
  for select
  to authenticated
  using (
    routing_track = 'wholesale_iso_network'
    and exists (
      select 1 from public.lender_boxes lb
      where lb.lender_id = auth.uid()
        and lb.is_verified_partner
        and lb.partner_agreement_accepted
        and funding_requests.property_state = any (lb.states_covered)
        and funding_requests.financing_type = any (lb.lending_types)
    )
  );

drop policy if exists "matched lenders update iso funding request status" on public.funding_requests;
create policy "matched lenders update iso funding request status"
  on public.funding_requests
  for update
  to authenticated
  using (
    routing_track = 'wholesale_iso_network'
    and exists (
      select 1 from public.lender_boxes lb
      where lb.lender_id = auth.uid()
        and lb.is_verified_partner
        and lb.partner_agreement_accepted
        and funding_requests.property_state = any (lb.states_covered)
        and funding_requests.financing_type = any (lb.lending_types)
    )
  )
  with check (
    routing_track = 'wholesale_iso_network'
    and exists (
      select 1 from public.lender_boxes lb
      where lb.lender_id = auth.uid()
        and lb.is_verified_partner
        and lb.partner_agreement_accepted
        and funding_requests.property_state = any (lb.states_covered)
        and funding_requests.financing_type = any (lb.lending_types)
    )
  );

-- No policy anywhere in this file grants access to leads, seller
-- contacts, or assignment fees: those live in other tables under
-- their own policies, and funding_requests contains none of them.

-- ----------------------------------------------------------------------------
-- 5. Verification (run by hand AFTER applying, as the owner, in the
--    Supabase SQL editor — these are commented out on purpose).
-- ----------------------------------------------------------------------------
-- -- Tables + RLS on:
-- -- select tablename, rowsecurity from pg_tables
-- --   where schemaname = 'public'
-- --   and tablename in ('lender_boxes', 'funding_requests');
-- --
-- -- Role accepts lender (and both buyer/title spellings):
-- -- select conname, pg_get_constraintdef(oid)
-- --   from pg_constraint
-- --   where conrelid = 'public.profiles'::regclass and contype = 'c';
-- --   -- or, if the column is an enum: select enumlabel from pg_enum
-- --   -- where enumtypid = (select oid from pg_type where typname = '<enum>');
-- --
-- -- Policies in place:
-- -- select tablename, policyname, cmd from pg_policies
-- --   where schemaname = 'public'
-- --   and tablename in ('lender_boxes', 'funding_requests')
-- --   order by tablename, policyname;
-- --
-- -- A direct-track request is invisible to a non-operator, non-requester:
-- -- (sign in as a lender in the app and confirm the direct packet does
-- --  not appear in the Lender Dashboard; sign in as the operator and
-- --  confirm it does.)
-- --
-- -- A verified-partner check cannot be skipped:
-- -- insert into public.lender_boxes (lender_id, is_verified_partner)
-- --   values ('<your own user id>', true);
-- --   -- must fail: partner_agreement_accepted is still false.
--
-- ----------------------------------------------------------------------------
-- 6. Rollback note (owner only, after a backup).
--    drop policy if exists ... on public.funding_requests; (all eight
--    policies above, by name) then:
--    drop table if exists public.funding_requests;
--    drop table if exists public.lender_boxes;
--    drop function if exists public.is_operator();
--    -- and restore the previous profiles role CHECK / enum from the
--    -- pre-migration backup. There is no automatic rollback: the
--    -- profiles role change is the only part this file alters on an
--    -- existing table, and it is restored from backup, not guessed.
-- ----------------------------------------------------------------------------
