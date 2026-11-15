-- ============================================================================
-- WholesalingOS — Capital & Lending Module, Slice 120: exact fee, fee-paid
-- confirmation, and status history.
-- Migration file ONLY. NOT APPLIED. NOT LIVE.
--
-- Run this in the Supabase SQL editor (owner step) against the project
-- that already ran 20261115090000_capital_lending_lender_role.sql.
-- Do NOT run it against any other project. It is written to be
-- idempotent: re-running it after a successful run changes nothing.
-- No secrets, keys, lenders, or deals are created by this file.
-- Nothing here touches leads, seller contacts, or assignment fees:
-- funding_requests holds none of those columns, and no policy below
-- can ever expose them.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Exact referral fee per deal (Slice 120, item 1).
--    fee_percentage is the exact percent agreed per deal, inside the
--    1.5%–2.0% range from the partner agreement. NULL means no exact
--    percent has been agreed yet — the notice keeps showing the range.
--    fee_amount is the computed dollar amount at that percent, written
--    by the operator's control (loan_amount_requested * pct / 100).
--    No percent is ever invented here: the columns start NULL.
-- ----------------------------------------------------------------------------
alter table public.funding_requests
  add column if not exists fee_percentage numeric;
alter table public.funding_requests
  add column if not exists fee_amount numeric;
alter table public.funding_requests
  drop constraint if exists funding_requests_fee_percentage_check;
alter table public.funding_requests
  add constraint funding_requests_fee_percentage_check
  check (fee_percentage is null or (fee_percentage >= 1.5 and fee_percentage <= 2.0));

-- ----------------------------------------------------------------------------
-- 2. Fee-paid confirmation (Slice 120, item 3).
--    fee_paid is false until the operator marks the referral fee
--    received after closing, with the amount actually received and
--    the date it arrived. Nothing here claims a fee was paid before
--    the operator records it.
-- ----------------------------------------------------------------------------
alter table public.funding_requests
  add column if not exists fee_paid boolean not null default false;
alter table public.funding_requests
  add column if not exists fee_paid_at timestamptz;
alter table public.funding_requests
  add column if not exists fee_paid_amount numeric;

-- ----------------------------------------------------------------------------
-- 3. Status history log (Slice 120, item 5).
--    One row per status change, append-only by design: no update or
--    delete policy is granted on this table at all, so a row, once
--    written, cannot be rewritten or removed through the API.
--    changed_by is the account that made the change; actor_role is
--    which side of the desk they were on. old_status is NULL for the
--    first row (the submission itself).
-- ----------------------------------------------------------------------------
create table if not exists public.funding_request_history (
  id uuid primary key default gen_random_uuid(),
  funding_request_id uuid not null references public.funding_requests (id) on delete cascade,
  changed_by uuid references public.profiles (id) on delete set null,
  actor_role text check (actor_role in ('requester', 'operator', 'lender')),
  old_status text,
  new_status text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists funding_request_history_request_idx
  on public.funding_request_history (funding_request_id);

alter table public.funding_request_history enable row level security;

-- Read visibility mirrors funding_requests exactly, so a history row
-- is visible to exactly the people who can see the packet it belongs
-- to — nobody else learns a packet even exists from its history.
drop policy if exists "requester reads own request history" on public.funding_request_history;
create policy "requester reads own request history"
  on public.funding_request_history
  for select
  to authenticated
  using (
    exists (
      select 1 from public.funding_requests fr
      where fr.id = funding_request_history.funding_request_id
        and fr.requester_id = auth.uid()
    )
  );

drop policy if exists "operator reads direct request history" on public.funding_request_history;
create policy "operator reads direct request history"
  on public.funding_request_history
  for select
  to authenticated
  using (
    exists (
      select 1 from public.funding_requests fr
      where fr.id = funding_request_history.funding_request_id
        and fr.routing_track = 'direct_feet_washers'
        and public.is_operator()
    )
  );

drop policy if exists "matched lenders read iso request history" on public.funding_request_history;
create policy "matched lenders read iso request history"
  on public.funding_request_history
  for select
  to authenticated
  using (
    exists (
      select 1 from public.funding_requests fr
      where fr.id = funding_request_history.funding_request_id
        and fr.routing_track = 'wholesale_iso_network'
        and exists (
          select 1 from public.lender_boxes lb
          where lb.lender_id = auth.uid()
            and lb.is_verified_partner
            and lb.partner_agreement_accepted
            and fr.property_state = any (lb.states_covered)
            and fr.financing_type = any (lb.lending_types)
        )
    )
  );

-- Insert is allowed only to someone who can see the parent request
-- under those same conditions, and only for their own account
-- (changed_by must be the signed-in user — no writing history for
-- someone else). No update or delete policy: history is append-only.
drop policy if exists "visible parties log request history" on public.funding_request_history;
create policy "visible parties log request history"
  on public.funding_request_history
  for insert
  to authenticated
  with check (
    changed_by = auth.uid()
    and (
      exists (
        select 1 from public.funding_requests fr
        where fr.id = funding_request_history.funding_request_id
          and fr.requester_id = auth.uid()
      )
      or exists (
        select 1 from public.funding_requests fr
        where fr.id = funding_request_history.funding_request_id
          and fr.routing_track = 'direct_feet_washers'
          and public.is_operator()
      )
      or exists (
        select 1 from public.funding_requests fr
        where fr.id = funding_request_history.funding_request_id
          and fr.routing_track = 'wholesale_iso_network'
          and exists (
            select 1 from public.lender_boxes lb
            where lb.lender_id = auth.uid()
              and lb.is_verified_partner
              and lb.partner_agreement_accepted
              and fr.property_state = any (lb.states_covered)
              and fr.financing_type = any (lb.lending_types)
          )
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 4. Verification (run by hand AFTER applying, as the owner, in the
--    Supabase SQL editor — these are commented out on purpose).
-- ----------------------------------------------------------------------------
-- -- New columns on funding_requests:
-- -- select column_name, data_type from information_schema.columns
-- --   where table_schema = 'public' and table_name = 'funding_requests'
-- --   and column_name in ('fee_percentage', 'fee_amount', 'fee_paid',
-- --     'fee_paid_at', 'fee_paid_amount');
-- --
-- -- History table + RLS on:
-- -- select tablename, rowsecurity from pg_tables
-- --   where schemaname = 'public'
-- --   and tablename = 'funding_request_history';
-- --
-- -- History policies in place (read x3, insert x1, no update/delete):
-- -- select tablename, policyname, cmd from pg_policies
-- --   where schemaname = 'public'
-- --   and tablename = 'funding_request_history'
-- --   order by policyname;
-- --
-- -- Fee range cannot be broken:
-- -- update public.funding_requests set fee_percentage = 2.5
-- --   where id = '<a real request id>';
-- --   -- must fail: the CHECK refuses anything outside 1.5–2.0.
-- --
-- -- History is append-only:
-- -- update public.funding_request_history set new_status = 'funded';
-- --   -- must fail: no update policy exists on this table.
--
-- ----------------------------------------------------------------------------
-- 5. Rollback note (owner only, after a backup).
--    drop table if exists public.funding_request_history;
--    alter table public.funding_requests
--      drop column if exists fee_percentage,
--      drop column if exists fee_amount,
--      drop column if exists fee_paid,
--      drop column if exists fee_paid_at,
--      drop column if exists fee_paid_amount;
--    -- The CHECK constraint on fee_percentage is dropped with the
--    -- column. The history table's policies are dropped with the
--    -- table. There is no automatic rollback of rows already logged.
-- ----------------------------------------------------------------------------
