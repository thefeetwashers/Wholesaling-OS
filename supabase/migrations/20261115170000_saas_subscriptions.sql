-- Slice 129 — SaaS subscriptions (platform billing).
--
-- One row per wholesaler: the 90-day free trial, then $150/month.
-- Pricing locked (founder): 90 days free, then $150/month for
-- wholesalers only; buyers, sellers, title companies, referrers,
-- and lenders are free; no per-deal cut, no percentage of
-- assignment fees. The platform collects NO money until the
-- Stripe account exists and the stripe-billing Edge Function is
-- deployed — both are OWNER steps and NOT done (the founder is
-- researching providers; no Stripe account exists yet).
--
-- BILLING MODEL — OPEN QUESTION (founder to decide, Nov 16,
-- 2026): this table + the stripe-billing function implement the
-- PLATFORM SUBSCRIPTION model (one Stripe account, $150/mo per
-- wholesaler, the platform is the merchant of record). The founder
-- also asked whether each wholesaler should get their OWN Stripe
-- account instead. If they decide that, this shape gets replaced —
-- do not quietly rewire it.
--
-- RLS (Sealed Office): a wholesaler reads/updates ONLY their own
-- row. The operator reads all rows via public.is_operator() (the
-- repo's one operator check — NOT the pasted auth.jwt() email
-- comparison, which bypasses the shared helper and breaks if the
-- operator email ever changes in one place). No anon access.
--
-- Triggers: a new auth.users row gets a trial row automatically
-- (handle_new_wholesaler_signup); a storefront_profiles save syncs
-- company_name + public_slug into the same row (sync trigger on
-- public.storefront_profiles — the REAL table; the pasted
-- wholesaler_storefronts does not exist). updated_at reuses
-- public.set_updated_at() from migration 1.

create table if not exists public.saas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  company_name text,
  storefront_slug text,
  plan_status text not null default 'trialing'
    check (plan_status in ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz not null default (now() + interval '90 days'),
  monthly_rate numeric(10, 2) not null default 150.00,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.saas_subscriptions enable row level security;

-- A wholesaler reads and updates only their own subscription row.
drop policy if exists "wholesaler reads own subscription" on public.saas_subscriptions;
create policy "wholesaler reads own subscription"
  on public.saas_subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "wholesaler updates own subscription" on public.saas_subscriptions;
create policy "wholesaler updates own subscription"
  on public.saas_subscriptions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- The operator reads all subscription rows (Sealed Office: the
-- operator is the only other reader). No operator UPDATE policy —
-- status changes go through the stripe-billing webhook or a
-- verified operator update, not an open policy.
drop policy if exists "operator reads all subscriptions" on public.saas_subscriptions;
create policy "operator reads all subscriptions"
  on public.saas_subscriptions
  for select
  to authenticated
  using (public.is_operator());

drop trigger if exists saas_subscriptions_set_updated_at on public.saas_subscriptions;
create trigger saas_subscriptions_set_updated_at
  before update on public.saas_subscriptions
  for each row execute function public.set_updated_at();

-- A new wholesaler signup starts a 90-day trial row automatically.
-- ON CONFLICT DO NOTHING so a re-run or a double trigger never
-- duplicates the row or resets the trial clock.
create or replace function public.handle_new_wholesaler_signup()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.saas_subscriptions (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_wholesaler_signup();

-- Keep the subscription row's company name + storefront slug in
-- sync with the wholesaler's public storefront profile. Runs on
-- storefront_profiles (the real table — NOT wholesaler_storefronts,
-- which does not exist). public_slug is the real column (NOT slug).
-- ON CONFLICT (user_id) DO UPDATE so a profile save never creates
-- a second subscription row and never resets the trial clock.
create or replace function public.sync_storefront_to_subscription()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.saas_subscriptions (user_id, company_name, storefront_slug)
  values (new.wholesaler_id, new.company_name, new.public_slug)
  on conflict (user_id) do update set
    company_name = excluded.company_name,
    storefront_slug = excluded.storefront_slug;
  return new;
end;
$$;

drop trigger if exists sync_storefront_subscription on public.storefront_profiles;
create trigger sync_storefront_subscription
  after insert or update on public.storefront_profiles
  for each row execute function public.sync_storefront_to_subscription();
