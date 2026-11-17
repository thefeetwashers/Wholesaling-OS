-- Fix — grant the app's roles access to tables created by migrations
--
-- What broke: Supabase does not automatically grant SELECT / INSERT / UPDATE /
-- DELETE to the `authenticated`, `anon`, or `service_role` roles on a table
-- created by a migration. Only the original `leads` table has those grants.
-- Every table created by Slices 118-130 therefore refused the app entirely:
-- the Probate Leads view showed "permission denied for table probate_leads"
-- and "Could not load probate leads.", and the first real probate import
-- (SearchResults__3.csv, 27 cases) parsed but saved 0 rows on 2026-11-17.
-- The RLS policies on those tables were correct — the grants were missing.
-- This file grants the privileges; the RLS policies remain the real gate
-- (a wholesaler still sees only their own rows; the operator read policies
-- still apply). Re-runnable: GRANT is idempotent.
--
-- Also adds the one missing policy found in the same diagnosis: a wholesaler
-- could not SELECT their own saas_subscriptions row (only INSERT/UPDATE
-- plus the operator SELECT existed), so the SubscriptionBanner read would
-- fail for any non-operator wholesaler.

-- App tables the signed-in wholesaler reads/writes through the app.
grant select, insert, update, delete on public.probate_leads to authenticated;
grant select, insert, update, delete on public.probate_lead_activity to authenticated;
grant select, insert, update, delete on public.cash_buyers to authenticated;
grant select, insert, update, delete on public.saas_subscriptions to authenticated;
grant select, insert, update, delete on public.funding_requests to authenticated;
grant select, insert, update, delete on public.funding_request_history to authenticated;
grant select, insert, update, delete on public.lender_boxes to authenticated;
grant select, insert, update, delete on public.scout_leads to authenticated;
grant select, insert, update, delete on public.vendor_directory to authenticated;
grant select, insert, update, delete on public.vendor_bid_requests to authenticated;
grant select, insert, update, delete on public.jv_listings to authenticated;
grant select, insert, update, delete on public.jv_interests to authenticated;
grant select, insert, update, delete on public.mail_credits_ledger to authenticated;
grant select, insert, update, delete on public.school_progress to authenticated;
grant select, insert, update, delete on public.seller_advance_requests to authenticated;
grant select, insert, update, delete on public.problem_reports to authenticated;

-- Public storefront pages are read without sign-in (anon); owners manage
-- their own storefront while signed in (authenticated).
grant select on public.storefront_profiles to anon, authenticated;
grant insert, update, delete on public.storefront_profiles to authenticated;

-- Server-side API routes (tracker, seller photo, intake) run as service_role.
grant select, insert, update, delete on public.probate_leads to service_role;
grant select, insert, update, delete on public.probate_lead_activity to service_role;
grant select, insert, update, delete on public.cash_buyers to service_role;
grant select, insert, update, delete on public.saas_subscriptions to service_role;
grant select, insert, update, delete on public.funding_requests to service_role;
grant select, insert, update, delete on public.funding_request_history to service_role;
grant select, insert, update, delete on public.lender_boxes to service_role;
grant select, insert, update, delete on public.scout_leads to service_role;
grant select, insert, update, delete on public.vendor_directory to service_role;
grant select, insert, update, delete on public.vendor_bid_requests to service_role;
grant select, insert, update, delete on public.jv_listings to service_role;
grant select, insert, update, delete on public.jv_interests to service_role;
grant select, insert, update, delete on public.mail_credits_ledger to service_role;
grant select, insert, update, delete on public.school_progress to service_role;
grant select, insert, update, delete on public.seller_advance_requests to service_role;
grant select, insert, update, delete on public.problem_reports to service_role;
grant select on public.storefront_profiles to service_role;

-- Missing policy: a wholesaler reads their own subscription row.
drop policy if exists "wholesaler reads own subscriptions" on public.saas_subscriptions;
create policy "wholesaler reads own subscriptions"
  on public.saas_subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());
