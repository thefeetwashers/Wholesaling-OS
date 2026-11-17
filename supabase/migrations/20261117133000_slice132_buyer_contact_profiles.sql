-- Slice 132 — Cash Buyer VIP Portal: buyer contact on the EXISTING
-- public.profiles table. (Correction, Nov 17, 2026: the earlier
-- instruction to create a public.buyer_profiles table is WITHDRAWN
-- and that migration file is deleted. No new buyer table exists in
-- this work. The paste's cash_buyers CREATE TABLE is likewise NOT
-- run — public.cash_buyers already exists from Slice 128 with a
-- different schema.)
--
-- Where the contact lives, column by column (read from the repo's
-- actual use of profiles — lib/portals.ts, lib/access.ts,
-- lib/my-states.ts, components/AuthPanel.tsx):
--   contact_email -> profiles.email. It ALREADY EXISTS: AuthPanel
--     upserts it at signup and loadMyProfile already returns it.
--     It is the account email the buyer signed up with; the VIP
--     form lets the buyer change it if deals should reach a
--     different inbox.
--   contact_name, contact_phone, contact_private -> ADDED HERE.
--     No contact-name / contact-phone / contact-private column
--     exists on profiles anywhere in the code read (the known
--     columns are id, email, role, referred_by, my_states,
--     company, public_slug, seller_page_* , subscription_status,
--     trial_ends_at, stripe_customer_id, admin_suspended), so
--     these three are added by ALTER TABLE — never a new table.
--
-- An ALTER adds NO new grants and needs NO new policy: owner
-- read/update of profiles already works (AuthPanel updates its
-- own role, my-states updates my_states, seller-page settings
-- update company/slug — all through the authenticated client).
-- NO anon INSERT WITH CHECK (true) policy anywhere here — no open
-- spam endpoint. The VIP form is for signed-in buyers only and
-- updates the caller's own row.
--
-- Privacy: contact stays private by default (contact_private
-- defaults true). It is never shown on the /buyers directory and
-- never publicly readable; it is revealed only through the
-- mutual-opt-in RPC get_buyer_contact_for_response (created at
-- the end of this file — Worker A's deal_responses table exists
-- in migration 20261117130000, which runs before this one).

alter table public.profiles
  add column if not exists contact_name text;
alter table public.profiles
  add column if not exists contact_phone text;
alter table public.profiles
  add column if not exists contact_private boolean not null default true;

-- Rollback (only if this migration itself must be undone):
--   alter table public.profiles drop column if exists contact_name;
--   alter table public.profiles drop column if exists contact_phone;
--   alter table public.profiles drop column if exists contact_private;

-- ------------------------------------------------------------------
-- MUTUAL-OPT-IN REVEAL — created here (coordinator correction,
-- Nov 17, 2026). Worker A's public.deal_responses table exists in
-- migration 20261117130000, which runs before this one, so the
-- function can be created now. The party columns are the REAL
-- ones: the responder is deal_responses.responder_id and the deal
-- owner is published_deals.user_id (reached through the deal_id
-- join) — the earlier draft's assumed buyer_user_id /
-- owner_user_id columns do not exist on deal_responses.
--
-- Pattern: the JV room (lib/jv-room.ts) — the interested party
-- shares their email by expressing interest, the originator shares
-- theirs by accepting, and nobody's contact is shown before both
-- opt-ins. Here the two opt-ins are the deal_responses flags
-- owner_contact_shared and responder_contact_shared on ONE
-- response row; the contact is returned only when BOTH are true
-- and the caller is the operator or one of the two parties.
-- The contact comes from public.profiles (contact_name, email,
-- contact_phone) — there is no buyer_profiles table. This returns
-- the RESPONDER's (buyer's) profile contact only: the owner's
-- contact has no column, so the deal detail page tells the buyer
-- the owner can now see their contact and will reach out.
-- The "Share my contact" buttons live on the deal detail page
-- (app/deals/[id]/page.tsx): the buyer sets their side, the
-- wholesaler sets theirs.

create or replace function public.get_buyer_contact_for_response(p_response_id uuid)
returns table (contact_name text, contact_email text, contact_phone text)
language sql
security definer
set search_path = public
as $$
  select p.contact_name, p.email, p.contact_phone
  from public.deal_responses dr
  join public.published_deals d on d.id = dr.deal_id
  join public.profiles p on p.id = dr.responder_id
  where dr.id = p_response_id
    and dr.owner_contact_shared = true
    and dr.responder_contact_shared = true
    and (
      public.is_operator()
      or dr.responder_id = auth.uid()
      or d.user_id = auth.uid()
    );
$$;

grant execute on function public.get_buyer_contact_for_response(uuid) to authenticated;
-- ------------------------------------------------------------------
