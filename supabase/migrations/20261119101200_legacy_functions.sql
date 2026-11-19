-- Legacy schema — the 4 verbatim function definitions.
--
-- Records the 4 function definitions from the dump's Query 3
-- section (legacy-schema-dump-20261117.md, Nov 17, 2026), all in
-- schema public, SECURITY DEFINER, SET search_path TO 'public'.
-- Each function body is copied character-for-character from the
-- dump. Nothing is fixed or improved; do NOT change the bodies.
--
-- This file goes LAST in the legacy-schema set because
-- admin_aggregates and buyer_record query deals,
-- marketplace_listings, offers, buy_boxes, escrow_files, and
-- profiles.
--
-- Notes recorded from the dump, NOT new gates:
--   * admin_aggregates counts legacy buy_boxes, frozen since the
--     app stopped writing there (Slice 136).
--   * buyer_record is SECURITY DEFINER with NO caller-side email
--     gate — any authenticated caller can call it for any buyer
--     id. That fact is recorded here; do NOT add a gate.
--
-- GRANT EXECUTE statements match the repo convention for SECURITY
-- DEFINER functions (grant execute to authenticated and
-- service_role, as the Slice 141 guard functions do). The grants
-- are the only addition; the function bodies are untouched.
-- NOT APPLIED. NOT LIVE.

-- admin_aggregates
CREATE OR REPLACE FUNCTION public.admin_aggregates()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when (auth.jwt() ->> 'email') = 'thefeetwashers@gmail.com' then jsonb_build_object(
      'profiles_total', (select count(*) from public.profiles),
      'profiles_by_role', (
        select coalesce(jsonb_object_agg(role, n), '{}'::jsonb)
        from (select role, count(*) as n from public.profiles group by role) r
      ),
      'subscriptions_by_status', (
        select coalesce(jsonb_object_agg(subscription_status, n), '{}'::jsonb)
        from (select subscription_status, count(*) as n from public.profiles group by subscription_status) s
      ),
      'deals_total', (select count(*) from public.deals),
      'listings_active', (select count(*) from public.marketplace_listings where listing_status = 'active'),
      'offers_total', (select count(*) from public.offers),
      'buy_boxes_total', (select count(*) from public.buy_boxes)
    )
    else '{}'::jsonb
  end;
$function$;

grant execute on function public.admin_aggregates() to authenticated;
grant execute on function public.admin_aggregates() to service_role;

-- admin_roster
CREATE OR REPLACE FUNCTION public.admin_roster()
 RETURNS TABLE(user_id uuid, email text, company text, role text, subscription_status text, trial_ends_at timestamp with time zone, admin_suspended boolean, has_stripe_customer boolean, created_at timestamp with time zone, referrer_email text, referral_credit_due boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ begin if coalesce(auth.jwt() ->> 'email', '') <> 'thefeetwashers@gmail.com' then return; end if; return query select p.id, p.email, p.company, p.role, p.subscription_status, p.trial_ends_at, p.admin_suspended, (p.stripe_customer_id is not null), p.created_at, r.email, (p.referred_by is not null and p.subscription_status = 'active' and p.role = 'wholesaler') from public.profiles p left join public.profiles r on r.id = p.referred_by order by p.created_at asc; end; $function$;

grant execute on function public.admin_roster() to authenticated;
grant execute on function public.admin_roster() to service_role;

-- admin_set_suspended
CREATE OR REPLACE FUNCTION public.admin_set_suspended(p_user_id uuid, p_suspended boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n int;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'thefeetwashers@gmail.com' then
    return false;
  end if;
  if exists (select 1 from public.profiles p
    where p.id = p_user_id and p.email = 'thefeetwashers@gmail.com') then
    return false;
  end if;
  update public.profiles set admin_suspended = p_suspended where id = p_user_id;
  get diagnostics n = row_count;
  return n > 0;
end;
$function$;

grant execute on function public.admin_set_suspended(uuid, boolean) to authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean) to service_role;

-- buyer_record
-- NOTE (from the dump): SECURITY DEFINER with NO caller-side email
-- gate — any authenticated caller can call it for any buyer id.
-- Recorded as-is; do NOT add a gate.
CREATE OR REPLACE FUNCTION public.buyer_record(p_buyer uuid)
 RETURNS TABLE(accepted_deals integer, bc_signed integer, closed_deals integer, fell_through integer, pof_status text, pof_note text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  select (select count(*)::int from public.deals d where d.documents->>'buyer_user' = p_buyer::text),
    (select count(*)::int from public.deals d where d.documents->>'buyer_user' = p_buyer::text and d.documents->>'bc_status' = 'Signed'),
    (select count(*)::int from public.escrow_files e join public.marketplace_listings l on l.id = e.listing_id join public.deals d on d.id = l.deal_id where d.documents->>'buyer_user' = p_buyer::text and e.outcome = 'closed'),
    (select count(*)::int from public.escrow_files e join public.marketplace_listings l on l.id = e.listing_id join public.deals d on d.id = l.deal_id where d.documents->>'buyer_user' = p_buyer::text and e.outcome = 'fell_through'),
    (select pr.pof_status from public.profiles pr where pr.id = p_buyer),
    (select pr.pof_note from public.profiles pr where pr.id = p_buyer);
end;
$function$;

grant execute on function public.buyer_record(uuid) to authenticated;
grant execute on function public.buyer_record(uuid) to service_role;
