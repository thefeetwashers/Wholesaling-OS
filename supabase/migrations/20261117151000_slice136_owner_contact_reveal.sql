-- Slice 136 — owner-contact reveal for deal responses.
--
-- The mirror of get_buyer_contact_for_response (migration
-- 20261117133000), which returns the RESPONDER's contact only.
-- That direction cannot serve the other side: the responder
-- needs the deal OWNER's contact through the same mutual-opt-in
-- gate, and profiles rows are owner-only under RLS, so no client
-- code can read the owner's contact directly. This function
-- returns the OWNER's profile contact (contact_name, email,
-- contact_phone from public.profiles, joined on
-- published_deals.user_id via the response's deal_id) under the
-- IDENTICAL gate: BOTH owner_contact_shared AND
-- responder_contact_shared must be true on the same
-- deal_responses row, AND the caller must be the operator or one
-- of the two parties to that response. Otherwise it returns no
-- rows. The owner sets their own contact fields with the same
-- profile form as any buyer (lib/buyer-profile.ts,
-- saveMyBuyerProfile — the columns exist since migration
-- 20261117133000; the email is the account email).
--
-- No new table, no new policy, no anon access. The GRANT is in
-- this file (the Nov 17 lesson: functions created by migrations
-- get no execute grant by default).
--
-- This replaces the delimiter hack, not the gate: the deal
-- detail page no longer embeds contact in the message column,
-- and old embedded contacts are stripped on read, never rendered.

create or replace function public.get_owner_contact_for_response(p_response_id uuid)
returns table (contact_name text, contact_email text, contact_phone text)
language sql
security definer
set search_path = public
as $$
  select p.contact_name, p.email, p.contact_phone
  from public.deal_responses dr
  join public.published_deals d on d.id = dr.deal_id
  join public.profiles p on p.id = d.user_id
  where dr.id = p_response_id
    and dr.owner_contact_shared = true
    and dr.responder_contact_shared = true
    and (
      public.is_operator()
      or dr.responder_id = auth.uid()
      or d.user_id = auth.uid()
    );
$$;

grant execute on function public.get_owner_contact_for_response(uuid) to authenticated;

-- Rollback (only if this migration itself must be undone):
--   drop function if exists public.get_owner_contact_for_response(uuid);
