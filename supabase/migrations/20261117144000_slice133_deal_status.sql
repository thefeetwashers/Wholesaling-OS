-- Slice 133 — deal status on public.published_deals.
--
-- Adds one column:
--   status text NOT NULL DEFAULT 'Active'
--     CHECK (status IN ('Active', 'Under Contract', 'Sold'))
--
-- The directory (/deals cards + /deals/[id]) shows the status as a
-- badge; the wholesaler changes it on their OWN deals from the
-- Published Deals table in the dashboard (components/
-- MyPublishedDeals.tsx via lib/deal-status.ts). Offers are blocked
-- when the deal is not Active — that check lives in the offer
-- flow, not here.
--
-- NO new table in this file:
--   * No public.deals table is created: it does not exist and
--     would duplicate published_deals.
--
-- Two additions the coordinator made at integration (Nov 17):
--   * An owner SELECT policy (below). Slice 132 gave the owner
--     INSERT / UPDATE / DELETE on their own rows and the public
--     only SELECT on published = true, but no owner SELECT: an
--     owner who unpublishes a deal can no longer read their own
--     row, so they cannot see it in My Published Deals, change
--     its status, or re-publish it. This policy closes that gap.
--     Sealed office is unchanged: it matches only
--     user_id = auth.uid().
--   * A DB-level offer gate (below). The offer form blocks
--     non-Active deals in the UI, but RLS alone cannot check the
--     deal's status, so a direct API caller could still insert an
--     offer on an Under Contract / Sold deal. The trigger is the
--     second lock. It depends on public.deal_offers from
--     migration 20261117140000, which runs first in timestamp
--     order.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, so the file re-runs
-- cleanly. No fake data is seeded. No OBL data of any kind.
--
-- Rollback (only if this migration itself must be undone):
--   alter table public.published_deals drop column if exists status;
--   drop trigger if exists deal_offers_require_active_deal on public.deal_offers;
--   drop function if exists public.reject_offer_on_inactive_deal();
--   drop policy if exists "owner reads own published deal" on public.published_deals;

alter table public.published_deals
  add column if not exists status text not null default 'Active'
  check (status in ('Active', 'Under Contract', 'Sold'));

comment on column public.published_deals.status is
  'Deal status shown as a badge on /deals and /deals/[id]. Active = open to offers; Under Contract / Sold = no new offers. Changed only by the deal owner.';

drop policy if exists "owner reads own published deal" on public.published_deals;
create policy "owner reads own published deal"
  on public.published_deals
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.reject_offer_on_inactive_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  deal_status text;
  deal_published boolean;
begin
  select status, published into deal_status, deal_published
    from public.published_deals
    where id = new.deal_id;
  if deal_status is distinct from 'Active' or deal_published is distinct from true then
    raise exception 'Offers are closed for this deal.';
  end if;
  return new;
end;
$$;

drop trigger if exists deal_offers_require_active_deal on public.deal_offers;
create trigger deal_offers_require_active_deal
  before insert on public.deal_offers
  for each row execute function public.reject_offer_on_inactive_deal();
