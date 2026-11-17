-- Slice 138 — fix the live RLS infinite-recursion bug on
-- funding_requests / lender_boxes.
--
-- THE BUG (found live Nov 17, 2026 ~15:45 EST): the signed-in
-- dashboard's Capital & Lending Partner Desk shows
--   'infinite recursion detected in policy for relation
--    "funding_requests" [42P17]'.
-- This is very likely the real cause behind the long-standing
-- "Could not load packets." failure — Slice 136 only surfaced the
-- database's error message; it did not fix the underlying query.
--
-- THE LOOP (from supabase/migrations/20261115090000):
--   * lender_boxes policy "requester reads matched lender boxes"
--     runs an EXISTS subquery directly against
--     public.funding_requests in its USING clause.
--   * funding_requests policies "matched lenders read iso funding
--     requests" and "matched lenders update iso funding request
--     status" run EXISTS subqueries directly against
--     public.lender_boxes in their USING / WITH CHECK clauses.
-- A query on either table makes Postgres evaluate the other
-- table's policies, which query the first table back — a
-- cross-table policy loop. is_operator() is SECURITY DEFINER and
-- reads only profiles, so it is NOT the loop; it is untouched.
--
-- THE FIX: two SECURITY DEFINER helper functions that perform the
-- same EXISTS checks with RLS bypassed, so evaluating one table's
-- policy no longer triggers the other table's policies. The three
-- affected policies are dropped and re-created so their USING /
-- WITH CHECK clauses call the helpers instead of running direct
-- subqueries against the other table. Matching semantics are
-- preserved EXACTLY (verified partner + agreement accepted +
-- state covered + financing type offered, ISO-network track only).
--
-- The helpers return a BOOLEAN only and take plain scalar
-- arguments (ids, a state, a financing type, and the box's own
-- state/type arrays). They return no row data and leak no key,
-- secret, or row content. No other policy is changed, no table or
-- column is added, and no grant on any other table is touched.
--
-- GRANTs are in THIS file (the Nov 17 lesson: functions created by
-- migrations get no EXECUTE grant by default).

-- Helper 1: the lender_boxes direction. Does this requester have
-- an ISO-network funding request matching this box's covered
-- states and lending types? (Same EXISTS the old lender_boxes
-- policy ran, now RLS-bypassed.)
create or replace function public.requester_has_matching_iso_request(
  p_requester_id uuid,
  p_states_covered text[],
  p_lending_types text[]
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.funding_requests fr
    where fr.requester_id = p_requester_id
      and fr.routing_track = 'wholesale_iso_network'
      and fr.property_state = any (p_states_covered)
      and fr.financing_type = any (p_lending_types)
  );
$$;

grant execute on function public.requester_has_matching_iso_request(uuid, text[], text[]) to authenticated;

-- Helper 2: the funding_requests direction. Does this lender have
-- a verified, agreement-accepted box covering this packet's state
-- and financing type? (Same EXISTS the old funding_requests
-- policies ran, now RLS-bypassed.)
create or replace function public.lender_has_matching_box(
  p_lender_id uuid,
  p_state text,
  p_financing_type text
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.lender_boxes lb
    where lb.lender_id = p_lender_id
      and lb.is_verified_partner
      and lb.partner_agreement_accepted
      and p_state = any (lb.states_covered)
      and p_financing_type = any (lb.lending_types)
  );
$$;

grant execute on function public.lender_has_matching_box(uuid, text, text) to authenticated;

-- Policy 1 of 3: lender_boxes — "requester reads matched lender
-- boxes" (SELECT). Same three conjuncts as before; the EXISTS is
-- now the helper call. states_covered / lending_types are the
-- current row's own columns.
drop policy if exists "requester reads matched lender boxes" on public.lender_boxes;
create policy "requester reads matched lender boxes"
  on public.lender_boxes
  for select
  to authenticated
  using (
    is_verified_partner
    and partner_agreement_accepted
    and public.requester_has_matching_iso_request(auth.uid(), states_covered, lending_types)
  );

-- Policy 2 of 3: funding_requests — "matched lenders read iso
-- funding requests" (SELECT). Same conjuncts as before; the EXISTS
-- is now the helper call.
drop policy if exists "matched lenders read iso funding requests" on public.funding_requests;
create policy "matched lenders read iso funding requests"
  on public.funding_requests
  for select
  to authenticated
  using (
    routing_track = 'wholesale_iso_network'
    and public.lender_has_matching_box(auth.uid(), funding_requests.property_state, funding_requests.financing_type)
  );

-- Policy 3 of 3: funding_requests — "matched lenders update iso
-- funding request status" (UPDATE). Same conjuncts as before in
-- both USING and WITH CHECK; the EXISTS is now the helper call.
drop policy if exists "matched lenders update iso funding request status" on public.funding_requests;
create policy "matched lenders update iso funding request status"
  on public.funding_requests
  for update
  to authenticated
  using (
    routing_track = 'wholesale_iso_network'
    and public.lender_has_matching_box(auth.uid(), funding_requests.property_state, funding_requests.financing_type)
  )
  with check (
    routing_track = 'wholesale_iso_network'
    and public.lender_has_matching_box(auth.uid(), funding_requests.property_state, funding_requests.financing_type)
  );

-- Rollback (only if this migration itself must be undone — it
-- restores the ORIGINAL three policies, which reintroduce the
-- recursion; do not run it as a fix):
--   drop function if exists public.requester_has_matching_iso_request(uuid, text[], text[]);
--   drop function if exists public.lender_has_matching_box(uuid, text, text);
--   (then re-run the three CREATE POLICY statements from
--    20261115090000_capital_lending_lender_role.sql)
