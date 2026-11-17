-- Slice 132 — Part 2: publish a buy box to the public Cash Buyers
-- directory (/buyers).
--
-- 1. ALTER TABLE ... ADD COLUMN adds NO new grants: the grants from
-- migration 20261117124100 (SELECT/INSERT/UPDATE/DELETE to
-- authenticated and to service_role) already cover the table, and an
-- added column needs none of its own. Nothing below re-grants what
-- already exists.
--
-- 2. The one thing the ALTER alone CANNOT do is serve a public
-- directory. The existing RLS on wholesaler_buy_boxes lets only the
-- owner read their own row (plus the operator via public.is_operator()).
-- Without a published-rows policy, /buyers would always render its
-- honest empty state even after wholesalers publish. So this file also
-- adds the minimal public read that the directory needs — and only
-- that:
--   * policy "anyone reads published buy boxes": SELECT for anon and
--     authenticated, ONLY where published = true. Unpublished rows
--     stay owner-only; no email, phone, or private field is ever in
--     this table (markets, property types, price range, notes only).
--   * grant select to anon: anon had no grant on this table at all
--     (the 20261117124100 grants cover authenticated + service_role
--     only), so the policy above would be dead without it. This is a
--     NEW grant for the NEW public read — not a re-grant of an
--     existing one. No INSERT/UPDATE/DELETE is granted to anon.
--
-- No policy or function here references a table created later in
-- this file. Nothing here sends email or messages. The private
-- per-wholesaler cash_buyers list is untouched — the directory shows
-- ONLY published buy boxes.

alter table public.wholesaler_buy_boxes
  add column if not exists published boolean not null default false;

-- Slice 132 follow-up (1) — buy-box extension for automated
-- matching. Target ZIP codes (empty by default — no ZIPs means no
-- ZIP constraint) and rehab tolerance: 'any' / 'light' /
-- 'moderate' / 'heavy', NULL/empty by default (empty means no
-- preference). No CHECK constraint on rehab_tolerance: the app
-- treats any value outside the four as "no preference", so a bad
-- value can never silently exclude matches.
alter table public.wholesaler_buy_boxes
  add column if not exists zip_codes text[] not null default '{}';
alter table public.wholesaler_buy_boxes
  add column if not exists rehab_tolerance text;
-- Slice 132 follow-up (D) — U.S. state codes, empty by default
-- (empty = no state constraint), so nationwide matching works
-- later. The field exists for matching only: Florida remains the
-- only state with live parcel data today, and other states join
-- only after their real service URL is verified live (Slice 123
-- registry rule). It promises no data for any other state.
alter table public.wholesaler_buy_boxes
  add column if not exists states text[] not null default '{}';
-- Slice 132 follow-up (5) — email-alert opt-in for the
-- match-and-email Edge Function. False by default: nobody is
-- emailed unless they explicitly opt in here. The function only
-- ever emails published buy boxes with this flag true, and only
-- for published deals; no email provider is connected today, so
-- nothing is sent either way.
alter table public.wholesaler_buy_boxes
  add column if not exists email_alerts_opt_in boolean not null default false;

drop policy if exists "anyone reads published buy boxes" on public.wholesaler_buy_boxes;
create policy "anyone reads published buy boxes"
  on public.wholesaler_buy_boxes
  for select
  to anon, authenticated
  using (published = true);

grant select on public.wholesaler_buy_boxes to anon;

-- Rollback (only if this migration itself must be undone):
--   drop policy if exists "anyone reads published buy boxes" on public.wholesaler_buy_boxes;
--   revoke select on public.wholesaler_buy_boxes from anon;
--   alter table public.wholesaler_buy_boxes drop column if exists published;
--   alter table public.wholesaler_buy_boxes drop column if exists zip_codes;
--   alter table public.wholesaler_buy_boxes drop column if exists rehab_tolerance;
--   alter table public.wholesaler_buy_boxes drop column if exists states;
--   alter table public.wholesaler_buy_boxes drop column if exists email_alerts_opt_in;
