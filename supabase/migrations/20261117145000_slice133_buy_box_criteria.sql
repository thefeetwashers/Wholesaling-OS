-- Slice 133 — buy-box criteria fields (wholesaler_buy_boxes).
--
-- Adds OBL-style criteria FIELDS ONLY to the wholesaler's own
-- buy box — field names, never OBL buyer data, names, or
-- numbers. No buyer, deal, price, or count is copied from
-- anywhere; these are empty-by-default criteria the buyer fills
-- in themselves (lib/buy-box.ts, components/BuyerNetworks.tsx).
--
--   max_arv_pct            numeric — max % of ARV the buyer will
--                          pay (empty = no constraint).
--   min_profit             numeric — min profit $ the buyer needs
--                          (empty = no constraint).
--   condition_preferences  text[]  — multi-select from the 5
--                          pinned conditions (Turnkey, Light
--                          rehab, Moderate rehab, Heavy rehab,
--                          Gut rehab).
--   strategy_preferences   text[]  — multi-select: Fix & Flip,
--                          Rental, BRRRR, Wholesale, New Build,
--                          Creative Finance, Other.
--   closing_timeline       text    — single select: '7 days or
--                          less', '8-14 days', '15-30 days',
--                          '30+ days' (empty = no constraint).
--
-- Matching (lib/match-buy-box.ts) uses each field ONLY when the
-- buyer set it; empty is no constraint, and a deal missing the
-- compared value passes that check rather than being excluded
-- on unknown data.
--
-- Idempotent ALTERs (ADD COLUMN IF NOT EXISTS), so re-running
-- this migration is safe. Grants already exist on
-- wholesaler_buy_boxes (earlier migrations) and no new access
-- pattern is introduced, so NO new policies and NO new grants
-- are added here. No function is created here, and nothing here
-- references a table created later in this file. Nothing here
-- sends email or messages.
--
-- NOT IN SLICE 133 (deferred to Slice 134): the "Broadcast to
-- My BYOK Buyers" button and the send-invite-blast Edge
-- Function. That paste code is broken (invalid Deno imports, a
-- Resend endpoint pointing at the homepage instead of the API,
-- reads user_channel_integrations which does not exist yet, and
-- claims buyers "will automatically receive deals" when no
-- auto-send exists). Slice 134 builds the per-wholesaler
-- provider store + dispatcher first; nothing broadcast-related
-- is built here.

alter table public.wholesaler_buy_boxes
  add column if not exists max_arv_pct numeric;

alter table public.wholesaler_buy_boxes
  add column if not exists min_profit numeric;

alter table public.wholesaler_buy_boxes
  add column if not exists condition_preferences text[] not null default '{}';

alter table public.wholesaler_buy_boxes
  add column if not exists strategy_preferences text[] not null default '{}';

alter table public.wholesaler_buy_boxes
  add column if not exists closing_timeline text;

-- Rollback (only if this migration itself must be undone):
--   alter table public.wholesaler_buy_boxes drop column if exists max_arv_pct;
--   alter table public.wholesaler_buy_boxes drop column if exists min_profit;
--   alter table public.wholesaler_buy_boxes drop column if exists condition_preferences;
--   alter table public.wholesaler_buy_boxes drop column if exists strategy_preferences;
--   alter table public.wholesaler_buy_boxes drop column if exists closing_timeline;
