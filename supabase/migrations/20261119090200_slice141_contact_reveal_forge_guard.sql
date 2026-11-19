-- Slice 141 (audit fixes, workstream B) — audit #4: contact-reveal
-- forge.
--
-- The hole: the "deal participants update responses" policy
-- (migration 20261117130000, public.deal_responses) gates the ROW
-- — either participant may update it — but puts no constraint on
-- the flag VALUES. Either side can set BOTH owner_contact_shared
-- and responder_contact_shared true with a direct PostgREST call
-- and forge the other side's opt-in, so the mutual-opt-in RPCs
-- (get_buyer_contact_for_response, get_owner_contact_for_response)
-- then reveal a contact nobody agreed to share.
--
-- The close, at the DB level: a BEFORE UPDATE trigger. Each side
-- may change ONLY its own flag:
--   * the deal owner (published_deals.user_id, reached through
--     the response's deal_id — deal_responses itself carries only
--     responder_id) may change owner_contact_shared;
--   * the responder (deal_responses.responder_id) may change
--     responder_contact_shared.
-- A caller who is both (an owner responding to their own deal)
-- may change both, since they are both parties. A caller who is
-- neither raises. The app's only update path is
-- lib/published-deals.ts shareContact, which sets exactly one
-- flag true for its own side — unchanged and passing.
--
-- Message / status columns are NOT gated here: no app code
-- updates them after insert, and the participant RLS policy
-- still gates the row. Service-role writes (auth.uid() is NULL)
-- and operator writes pass untouched.
--
-- The RPCs are NOT changed by this migration. Both RPCs were
-- re-read: neither references contact_private, so the claim in
-- lib/buyer-profile.ts that "contact_private is the floor" was
-- false. That claim is corrected in code instead (see
-- lib/buyer-profile.ts): contact_private keeps the contact out
-- of the public /buyers directory and plain profile reads, and
-- the VIP form's own label promises sharing "when we both agree
-- on a deal" — so gating the RPCs on contact_private (which
-- defaults true for every buyer) would silently break the share
-- flow for everyone who never touched the toggle. The reveal
-- gate stays what the RPCs actually enforce: BOTH share flags
-- true AND the caller is the operator or one of the two parties
-- — and the per-deal share tap is itself the explicit consent.
--
-- Grants are in this file (the Nov 17 lesson). No new secrets,
-- no new fields, no live status claimed. NOT APPLIED. NOT LIVE.

create or replace function public.guard_deal_response_contact_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  deal_owner uuid;
  is_owner boolean;
  is_responder boolean;
begin
  -- Service-role writes (auth.uid() is NULL) and operator writes
  -- pass untouched.
  if auth.uid() is null or public.is_operator() then
    return new;
  end if;
  select d.user_id into deal_owner
    from public.published_deals d
   where d.id = new.deal_id;
  is_owner := (deal_owner = auth.uid());
  is_responder := (new.responder_id = auth.uid());
  if not (is_owner or is_responder) then
    raise exception 'Only the deal owner or the responder can update this response.';
  end if;
  -- Each side may change only its own flag. (A caller who is
  -- both sides may change both.)
  if not is_responder
    and new.responder_contact_shared is distinct from old.responder_contact_shared then
    raise exception 'Only the responder can change the responder contact-share flag.';
  end if;
  if not is_owner
    and new.owner_contact_shared is distinct from old.owner_contact_shared then
    raise exception 'Only the deal owner can change the owner contact-share flag.';
  end if;
  return new;
end;
$$;

drop trigger if exists deal_responses_guard_contact_flags on public.deal_responses;
create trigger deal_responses_guard_contact_flags
  before update on public.deal_responses
  for each row execute function public.guard_deal_response_contact_flags();

grant execute on function public.guard_deal_response_contact_flags() to authenticated;
grant execute on function public.guard_deal_response_contact_flags() to service_role;

-- Rollback (only if this migration itself must be undone):
--   drop trigger if exists deal_responses_guard_contact_flags on public.deal_responses;
--   drop function if exists public.guard_deal_response_contact_flags();
