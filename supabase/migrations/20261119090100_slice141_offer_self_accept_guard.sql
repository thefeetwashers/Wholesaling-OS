-- Slice 141 (audit fixes, workstream B) — audit #3: offer
-- self-accept.
--
-- The holes (migration 20261117140000, public.deal_offers):
--   * the buyer INSERT policy has no status constraint, so a
--     buyer can insert their own offer already status='accepted'
--     with a direct PostgREST call;
--   * the buyer-withdraw UPDATE policy has no status constraint,
--     so a buyer can update their own offer to 'accepted' (its
--     USING passes on buyer_id = auth.uid(), its WITH CHECK asks
--     only buyer_id = auth.uid());
--   * the existing BEFORE INSERT trigger
--     public.reject_offer_on_inactive_deal() (migration
--     20261117144000) never gates UPDATE, so an accept/decline
--     also lands after the deal has since gone Under Contract /
--     Sold or unpublished.
--
-- The close, at the DB level, in two parts:
--   1. Drop and re-create the buyer INSERT policy with
--      WITH CHECK status = 'pending' (the app already inserts
--      'pending' explicitly — lib/deal-offers.ts submitOffer —
--      and the column default is 'pending', so no legitimate
--      insert changes).
--   2. A BEFORE UPDATE trigger that gates every status change:
--        - only a status change is gated; edits to price / EMD /
--          closing date on the caller's own offer are untouched;
--        - terminal states are final: nothing moves out of a
--          non-'pending' status, so a decided or withdrawn offer
--          cannot be resurrected (decideOffer / withdrawOffer
--          already filter status = 'pending' app-side);
--        - 'withdrawn' may be set only by the offering buyer
--          (or the operator — see note below);
--        - 'accepted' / 'declined' may be set only by the deal
--          owner (published_deals.user_id for the offer's deal)
--          or the operator, and are refused when the deal is no
--          longer Active-and-published (the UPDATE-side mirror
--          of the INSERT trigger).
--
-- Note: no operator UPDATE policy exists on deal_offers today
-- (the operator reads only), so an operator browser session is
-- already refused by RLS before the trigger runs; the trigger's
-- operator allowance is future-proofing, not a new grant, and no
-- policy is added here.
--
-- Service-role writes (auth.uid() is NULL, e.g. admin) pass
-- untouched. No policy in 20261117140000 is edited except the
-- buyer INSERT policy re-created above; the owner-decide and
-- buyer-withdraw UPDATE policies stay as the row gate, and the
-- trigger is the value gate.
--
-- Grants are in this file (the Nov 17 lesson). No new secrets,
-- no new prices, no live status claimed. NOT APPLIED. NOT LIVE.

-- 1. Buyer INSERT: pending only.
drop policy if exists "buyer inserts own deal offer" on public.deal_offers;
create policy "buyer inserts own deal offer"
  on public.deal_offers
  for insert
  to authenticated
  with check (
    buyer_id = auth.uid()
    and status = 'pending'
  );

-- 2. Status-change guard.
create or replace function public.guard_deal_offer_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  deal_owner uuid;
  deal_status text;
  deal_published boolean;
begin
  -- Only a status change is gated.
  if new.status is not distinct from old.status then
    return new;
  end if;
  -- Service-role writes pass untouched.
  if auth.uid() is null then
    return new;
  end if;
  -- Terminal states are final.
  if old.status is distinct from 'pending' then
    raise exception 'This offer has already been decided or withdrawn.';
  end if;
  select d.user_id, d.status, d.published
    into deal_owner, deal_status, deal_published
    from public.published_deals d
   where d.id = new.deal_id;
  if new.status = 'withdrawn' then
    if new.buyer_id = auth.uid() or public.is_operator() then
      return new;
    end if;
    raise exception 'Only the offering buyer can withdraw this offer.';
  elsif new.status in ('accepted', 'declined') then
    if not (deal_owner = auth.uid() or public.is_operator()) then
      raise exception 'Only the deal owner can accept or decline this offer.';
    end if;
    -- The deal must still be open: the INSERT trigger only
    -- checks this at insert time, so a deal that went Under
    -- Contract / Sold or unpublished after the offer was made
    -- refuses a late accept / decline here.
    if deal_status is distinct from 'Active' or deal_published is distinct from true then
      raise exception 'Offers are closed for this deal.';
    end if;
    return new;
  else
    -- Unreachable under the status CHECK, but refuse anything
    -- that is not a known transition rather than passing it.
    raise exception 'That offer status change is not allowed.';
  end if;
end;
$$;

drop trigger if exists deal_offers_guard_status on public.deal_offers;
create trigger deal_offers_guard_status
  before update on public.deal_offers
  for each row execute function public.guard_deal_offer_status();

grant execute on function public.guard_deal_offer_status() to authenticated;
grant execute on function public.guard_deal_offer_status() to service_role;

-- Rollback (only if this migration itself must be undone):
--   drop trigger if exists deal_offers_guard_status on public.deal_offers;
--   drop function if exists public.guard_deal_offer_status();
--   drop policy if exists "buyer inserts own deal offer" on public.deal_offers;
--   create policy "buyer inserts own deal offer"
--     on public.deal_offers for insert to authenticated
--     with check (buyer_id = auth.uid());
