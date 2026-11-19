-- Slice 141 (audit fixes, workstream B) — audits #5, #7, #6, #9:
-- billing self-exempt, exemption durability, dead admin
-- Change-plan.
--
-- (a) Audit #5 — self-exempt. The "wholesaler updates own
--     subscription" policy (migration 20261115170000,
--     public.saas_subscriptions) permits UPDATE on the caller's
--     own row with no column restriction, and RLS cannot restrict
--     columns. Any wholesaler could set is_founder_exempt = true,
--     plan_status = 'active', or monthly_rate = 0 from the
--     browser. The close is a BEFORE UPDATE trigger guard: a
--     signed-in non-operator caller may not change
--     is_founder_exempt, plan_status, or monthly_rate.
--     Allowed columns for a non-operator were decided from the
--     code actually read: there is NO legitimate browser-side
--     write to this table by a wholesaler at all —
--     components/SubscriptionBanner.tsx reads only, and the only
--     browser write is the operator's changeStatus (below). The
--     guard therefore lets non-guarded columns through (so the
--     storefront sync trigger, which updates company_name /
--     storefront_slug as the signed-in wholesaler, keeps
--     working) and blocks only the three billing columns.
--     Service-role writes pass untouched (auth.uid() is NULL):
--     the Stripe webhook (app/api/stripe/webhook/route.ts) and
--     the stripe-billing Edge Function both use the service-role
--     key, and both already skip founder-exempt rows themselves.
--     Operator writes pass (public.is_operator()).
--
-- (b) Audit #7 — durability. handle_new_wholesaler_signup()
--     (migration 20261115170000) created every new row exempt =
--     false, so a re-created founder row would lose the
--     exemption. It is re-created here (CREATE OR REPLACE) so a
--     new row for thefeetwashers@gmail.com is created with
--     is_founder_exempt = true — the same email literal
--     public.is_operator() uses; is_operator() itself and the
--     operator email definition are NOT touched. The
--     on_auth_user_created_subscription trigger on auth.users is
--     NOT dropped or re-created; it keeps calling this function.
--     A belt-and-braces backfill sets the flag on any existing
--     founder row where it is currently false (matching Slice
--     140's profiles-email lookup) and touches no other column:
--     the founder's live row is already exempt, so in practice
--     this updates nothing, and it never changes any other value
--     on that row.
--
-- (c) Audit #6 — dead admin Change-plan. No operator UPDATE
--     policy ever existed on saas_subscriptions (migration
--     20261115170000 notes it explicitly), so
--     components/AdminSaaSDashboard.tsx changeStatus() was
--     refused by RLS and silently failed. An operator-only
--     UPDATE policy is added here, so the admin write can
--     actually land. The trigger guard in (a) still lets
--     operator writes through.
--
-- (d) Audit #9 — the component guard itself is in
--     components/AdminSaaSDashboard.tsx: changeStatus() refuses
--     a founder-exempt row with "Founder — exempt, cannot
--     change." (App-level only — see the note there: the DB
--     trigger deliberately still allows operator writes, so an
--     operator direct API call could still change an exempt
--     row's plan; the guard stops the accidental dashboard click.)
--
-- Grants are in this file (the Nov 17 lesson). No new secrets,
-- no new prices, no live status claimed. NOT APPLIED. NOT LIVE.

-- (a) Billing-field guard.
create or replace function public.guard_subscription_billing_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role writes (auth.uid() is NULL) and operator writes
  -- pass untouched.
  if auth.uid() is null or public.is_operator() then
    return new;
  end if;
  -- A signed-in non-operator may never change a billing field.
  -- Other columns (company_name / storefront_slug from the
  -- storefront sync trigger) pass through unchanged.
  if new.is_founder_exempt is distinct from old.is_founder_exempt
    or new.plan_status is distinct from old.plan_status
    or new.monthly_rate is distinct from old.monthly_rate then
    raise exception 'Only the operator can change billing status, rate, or the founder exemption.';
  end if;
  return new;
end;
$$;

drop trigger if exists saas_subscriptions_guard_billing on public.saas_subscriptions;
create trigger saas_subscriptions_guard_billing
  before update on public.saas_subscriptions
  for each row execute function public.guard_subscription_billing_fields();

grant execute on function public.guard_subscription_billing_fields() to authenticated;
grant execute on function public.guard_subscription_billing_fields() to service_role;

-- (c) Operator-only UPDATE policy, so AdminSaaSDashboard
-- changeStatus() can actually write.
drop policy if exists "operator updates subscriptions" on public.saas_subscriptions;
create policy "operator updates subscriptions"
  on public.saas_subscriptions
  for update
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());

-- (b) Durable exemption at signup: a new row for the founder's
-- account is created exempt. Same email literal as
-- public.is_operator(); that function is not changed.
create or replace function public.handle_new_wholesaler_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.saas_subscriptions (user_id, email, is_founder_exempt)
  values (new.id, new.email, new.email = 'thefeetwashers@gmail.com')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

grant execute on function public.handle_new_wholesaler_signup() to authenticated;
grant execute on function public.handle_new_wholesaler_signup() to service_role;

-- (b) Belt-and-braces backfill: set the flag on any existing
-- founder row where it is currently false. Touches ONLY
-- is_founder_exempt, and only for the founder's account — no
-- other value on any row changes.
update public.saas_subscriptions
   set is_founder_exempt = true
 where is_founder_exempt = false
   and user_id in (select id from public.profiles where email = 'thefeetwashers@gmail.com');

-- Rollback (only if this migration itself must be undone):
--   drop policy if exists "operator updates subscriptions" on public.saas_subscriptions;
--   drop trigger if exists saas_subscriptions_guard_billing on public.saas_subscriptions;
--   drop function if exists public.guard_subscription_billing_fields();
--   -- handle_new_wholesaler_signup() would need its pre-Slice-141
--   -- body restored from migration 20261115170000; the backfill
--   -- UPDATE above cannot be un-run without knowing which rows
--   -- it touched (in practice: none — the founder row was
--   -- already exempt).
