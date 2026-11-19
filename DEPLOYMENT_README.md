# WholesalingOS — Developer Deployment README

> The platform is **WholesalingOS** at **https://wholesalingos.thefeetwashers.com**
> (and **https://wholesalingos.vercel.app**). `thefeetwashers.com` is the
> HOME-CARE site — it is never the platform URL. Every URL in this file uses
> the `wholesalingos` domain.

This file is the deployment guide for a developer picking up the repo. It
lists the system as it actually is — file names, migration names, routes, and
environment variables were all verified against the tree on Nov 17, 2026.
Nothing in here is aspirational: a feature marked "not live" is not live.

## 1. Stack (as it actually is)

- Next.js 14 (App Router) + React 18, plain CSS in `app/globals.css`.
- Supabase via `lib/supabase.ts` (browser client) + service-role API routes
  under `app/api/` for server-side work. There is **no** `utils/supabase/`
  path and **no** `@supabase/ssr` — do not install it.
- Dependencies (see `package.json`): `@supabase/supabase-js`, `next`,
  `react`, `react-dom`, `stripe`, `qrcode`, `xlsx` (SheetJS, for Excel
  upload — Slice 128 gap fix), Capacitor (Android/iOS shells).
- There is no Tailwind and no lucide-react in this repo. Do not add them
  as if they were already here.
- Typecheck (the repo has no `tsconfig.json`; this is the command):
  `npx tsc --noEmit --jsx react-jsx --esModuleInterop --skipLibCheck --module esnext --moduleResolution bundler --target es2020 $(find app components lib -name "*.ts" -o -name "*.tsx" | grep -v node_modules)`
  It must exit 0 before any push.

## 2. Real file map

There is one dashboard: `app/page.tsx` + the PortalHome/Sidebar views.
There is no second dashboard shell — `WholesalingOSDashboard.tsx` does not
exist and must not be built. The following rejected names never appear in
this repo: `ProbatePriorityLeads.tsx`, `DistressedOffMarketRadar.tsx`,
`InboundSellerLeadsTable.tsx`, `StorefrontSettingsForm.tsx`,
`WholesalerStorefrontPage.tsx`, `lib/supabase/probateLeadsApi.ts`,
`wholesaler_storefronts`, `seller_leads`, `distressed_leads`.

### Probate (Slice 127)

- `supabase/migrations/20261115150000_probate_leads.sql` — `probate_leads`
  table + `leads.probate_case_number` + the 18-param seller RPCs +
  `probate_lead_activity` (append-only contact history).
- `lib/probate-import.ts` — docket CSV parser (quote-aware, BOM/CRLF,
  strips `(YYYY)` birth years, groups by case; CLOSED imports as archived).
- `lib/probate-leads-api.ts` — fetch/update/merge helpers + `logProbateActivity`.
- `lib/spreadsheet.ts` — Excel upload (first sheet only → same pipeline as CSV).
- `components/ProbateLeads.tsx` — the Probate Leads desk (tabs, search,
  PASLC link + copy-last-name, manual skip-trace entry, Draft Outreach /
  Print Letter / Draft Contract buttons, seller cross-link, CSV export).
- `components/ProbateOutreachModal.tsx` — draft SMS/email from the approved
  scripts-desk probate wording; only "I sent this — Mark as Contacted"
  changes status (and writes the activity row).
- `components/ProbateDirectMailPrintModal.tsx` — print-ready probate letter
  with a goqr.me QR code; only "I mailed this — Mark as Contacted" changes
  status (and writes the activity row). Print alone changes nothing.
- `supabase/functions/skip-trace-decision-maker/index.ts` — Edge Function,
  file only, **NOT deployed** (see §5).

### Storefront (Slices 124–125) + Leads

- `app/sell/[slug]/page.tsx` — public 2-step seller form (TCPA checkbox,
  photo dropzone, voice intake, video hello, trilingual toggle, tracker).
  It reads `storefront_profiles` and the `?case=` probate tag, which lands
  on `leads.probate_case_number` through both seller RPCs.
- `components/StorefrontSettings.tsx` — the live settings panel (saves via
  `lib/storefront.ts`, slug synced through `lib/portals.ts`).
- `components/Leads.tsx` + `components/LeadOfferTracker.tsx` — the inbound
  leads dashboard (Probate Linked + Step-1 Partial + distress-type +
  100+ days filters, probate badge, case-number search, Draft Contract).
- `components/CsvLeadImporter.tsx` — distress-list importer (CSV or Excel,
  7 distress tags incl. `fire_damage`, address-optional rows — see §6).

### Contracts + Cash Buyers (Slice 128)

- `lib/contracts.ts` — `buildPurchaseAgreement()` (A-to-B) +
  `buildAssignmentContract()` (B-to-C); attorney-review banner top and
  bottom; all money fields empty by default in the form.
- `components/WholesaleContractGenerator.tsx` — form + live preview +
  print / `.txt` export. Print is blocked until the agreed price (and,
  for the assignment, the fee) is entered.
- `supabase/migrations/20261115160000_cash_buyers.sql` — `cash_buyers`
  table (UNIQUE(user_id, email), operator read policy).
- `components/CashBuyersDealBlast.tsx` — cash buyers CRM + deal blast
  (copy primary, BCC mailto convenience only — the app never auto-sends).

### Slice 129 — Google Skip-Trace, county presets, smart parser, master search, JV Split, SaaS Admin + Stripe

- `lib/google-skip-trace.ts` — Method 1 helper: builds the targeted
  `https://www.google.com/search?q=<encoded>` lookup URL (no API, no
  key). `components/GoogleSkipTraceModal.tsx` — one shared modal for
  probate decision-makers and distressed/inbound leads: calls the
  google-skip-trace function on open, shows detected phones/emails
  (selectable, first only), top 5 sources, the Open in Google Search
  fallback, and empty-by-default manual inputs; saving writes via the
  verified write path and never marks Contacted.
- `supabase/functions/google-skip-trace/index.ts` — Edge Function, file
  only, **NOT deployed** (see §5). BYOK per wholesaler; the live branch
  is DISABLED because Google's Custom Search JSON API is closed to new
  customers and discontinued Jan 1, 2027.
- `lib/floridaCountyPresets.ts` + `components/CountyPresetBar.tsx` — 7
  Florida counties (St. Lucie, Broward, Palm Beach, Miami-Dade, Martin,
  Indian River, Charlotte) with verified clerk + appraiser URLs (see
  the file header for the verification table). The probate checkbox
  lists are UNVERIFIED — the bar labels them "Clerk filters — confirm
  on the clerk site". The bar is wired into ProbateLeads (below the
  upload header) and the County Desk (above the distress importer).
- `lib/probate-import.ts` — the parser now takes a county param and
  maps headers by alias (Broward-style "Party Name / Role / Case #" /
  "Case Status" included), detects tab-delimited exports, and
  normalizes roles; `paslc_search_url` comes from the selected county
  preset (paslc.gov for St. Lucie, the preset's verified appraiser
  page elsewhere, null for a county with no preset).
- `components/GlobalSearch.tsx` — master search: probate_leads,
  leads (distressed = `distress_tag` set, inbound = list_source
  'Seller landing page'), cash_buyers (real columns), grouped with
  badges, Cmd+K/Ctrl+K focus, Draft contract button on probate/inbound
  hits. `lib/cash-buyers.ts` — the cash_buyers loader the search uses.
- `components/JVCoWholesalingCalculator.tsx` — JV Split calculator
  (Pipeline nav): A-to-B / B-to-C / shared costs all empty by default,
  split slider 10–90%, live payouts, Partner A from the signed-in
  wholesaler's own storefront profile, Partner B typed in; the
  printable agreement reuses `buildJVSplitAgreement()` — no second
  template.
- `supabase/migrations/20261115170000_saas_subscriptions.sql` —
  `saas_subscriptions` (90-day trial, $150/mo; owner-reads-own +
  operator-reads-all via `public.is_operator()`; signup + storefront
  sync triggers). `components/AdminSaaSDashboard.tsx` — operator-only
  SaaS Admin view (real rows only, honest empty state).
  `components/SubscriptionBanner.tsx` — trial countdown + Activate Plan
  / Pro Active + Manage Billing on the dashboard; shows "Billing setup
  pending" instead of a dead checkout while Stripe is unconfigured.
  `supabase/functions/stripe-billing/index.ts` — Edge Function, file
  only, **NOT deployed** (see §10).
- `supabase/migrations/20261115180000_leads_owner_contact.sql` —
  `owner_phone` / `owner_email` on `public.leads` (nullable text) for
  the Google lookup save. No `distressed_leads` table.
- `scripts/verify-wholesalingos.mjs` — pre-flight check (real files,
  real tables via the REST API, the 3 Edge Functions via OPTIONS).
  Run: `node --env-file=.env.local scripts/verify-wholesalingos.mjs`.
  A 401/403 on a table means "reachable (anon blocked)" — it does NOT
  prove RLS; RLS is proven by the migration files. Edge Functions are
  expected to report missing until the owner deploys them.

### Slice 130 — Operator Stats, W-9 gate, Report-a-Problem, term sheet rate/term

- `supabase/migrations/20261117090000_slice130_operator_visibility.sql` —
  `scout_leads.w9_received` + `w9_received_at` + CHECK that
  `closed_paid_1000` requires `w9_received = TRUE`;
  `funding_requests.interest_rate` (numeric, NULL or > 0) +
  `loan_term_months` (integer, NULL or > 0); `problem_reports` table
  (category CHECK, subject + details NOT NULL, status
  open/reviewing/resolved, reporter INSERT own + SELECT own, operator
  SELECT all + UPDATE status via `public.is_operator()`).
- `lib/scouts.ts` — `w9_received` / `w9_received_at` on the ScoutLead
  type and select, plus `setScoutLeadW9` (verified write).
  `components/ScoutPortal.tsx` — "W-9 received" checkbox on each
  claimed lead in MyClaimedLeads + the payout block
  ("W-9 needed before payout — mark W-9 received first."). No change
  to the $1,000 amount or the 180-day rule; no RLS change (the
  claiming wholesaler could already update their claimed leads).
- `lib/funding.ts` — `interest_rate` / `loan_term_months` on the
  FundingRequest type and select, plus `setFundingRateTerm` (operator
  email guard; blank clears to NULL). `components/Contracts.tsx` —
  rate + term inputs next to "Set agreed fee %" in the operator
  direct-track view (empty by default) and the stored values passed
  into the packet; `buildTermSheet` renders them when set, "TO BE
  AGREED" when blank, DRAFT until `term_sheet_issued` (unchanged).
- `components/OperatorStats.tsx` — operator-only view (real rows
  only: wholesalers, verified badges, leads total + by distress tag +
  seller submissions, probate total/open/pro se, funding by status,
  scouts by status + W-9 count, cash buyers, JV listings, vendors;
  honest "0 — none yet" states; no billing numbers — SaaS Admin
  covers billing) + the problem-report triage list (Mark reviewing /
  Mark resolved, verified writes). Wired as the "Operator Stats" view
  under Platform owner in the sidebar.
- `lib/problem-reports.ts` + `components/ReportProblemModal.tsx` —
  category select, subject + details (both required, empty by
  default), page context auto-filled from the open view; the modal
  states plainly that the report goes to the operator's desk in the
  app and the app does not send email. The "Report a problem" button
  sits at the foot of the sidebar (signed-in users only).

### Slice 131 — Buyer Networks (OpenBuyersList links + my buy box)

- `supabase/migrations/20261117124100_buyer_networks_buy_box.sql` —
  `wholesaler_buy_boxes` table (one row per wholesaler:
  `UNIQUE(user_id)`, markets + property_types, min/max price,
  notes; owner RLS + operator read via `public.is_operator()`,
  `set_updated_at()` trigger) — with the GRANTs in the SAME file
  (SELECT/INSERT/UPDATE/DELETE to `authenticated` and to
  `service_role`), per the Nov 17 lesson: tables created by
  migrations get no data grants by default, and without them the app
  fails with "permission denied for table".
- `lib/buy-box.ts` — `loadMyBuyBox()` + `saveMyBuyBox()` (upsert on
  `user_id`, verified write — the saved row is selected back).
  `components/BuyerNetworks.tsx` — rendered INSIDE the Cash Buyers
  view, below the buyer list: plain text that OpenBuyersList is a
  free network where cash buyers publish their buy box, with the
  plain statement that WholesalingOS does not copy their buyer list;
  "Browse buyers on OpenBuyersList" →
  `https://openbuyerslist.com/off-market-deals` (verified Nov 17,
  2026 by following the homepage's own "Browse All Off Market
  Deals" link) and "Join or post on OpenBuyersList" →
  `https://openbuyerslist.com/`; the "My buy box" card (67-county
  markets, same property-type options as the cash-buyer form, min/max
  price, notes — all empty by default; Save via verified write;
  "Copy my buy box" for pasting into OpenBuyersList); the honest
  hedge-fund line (institutional buyers buy through their own
  acquisition teams, not from a shared list). No OBL counts shown,
  no fund named, no buyer data copied, no API client or scraper.

### Slice 132 — OBL-inspired marketplace + dashboard upgrade + buy-box matching + free-stack underwriting

- `supabase/migrations/20261117130000_slice132_marketplace_tables.sql` —
  `published_deals` (owner opt-in public listing; condition pinned to
  the five values; comps jsonb max 4 wholesaler-entered only;
  `county` column for matching; public SELECT on published rows
  only + owner INSERT/UPDATE/DELETE + operator read), `deal_responses`
  (mutual-opt-in flags `owner_contact_shared` /
  `responder_contact_shared`; participants read/update, operator
  read), `managed_dispo_requests` (status requested default; owner +
  operator RLS) — GRANTs to `authenticated` + `service_role` and
  SELECT to `anon` on published_deals in the SAME file; no anon
  INSERT anywhere. No `public.deals` table (duplicate of
  published_deals — rejected).
- `supabase/migrations/20261117131000_slice132_buy_box_published.sql` —
  adds `published` + `zip_codes` + `rehab_tolerance` + `states` +
  `email_alerts_opt_in` (default false) to `wholesaler_buy_boxes`,
  plus the minimal public read (SELECT for anon + authenticated
  where `published = true`; anon SELECT grant only).
- `supabase/migrations/20261117133000_slice132_buyer_contact_profiles.sql` —
  ALTER TABLE `profiles` adds `contact_name`, `contact_phone`,
  `contact_private` only (the `buyer_profiles` table instruction was
  WITHDRAWN and that file deleted; no new buyer table; no anon
  INSERT policy) + the mutual-opt-in RPC
  `get_buyer_contact_for_response(uuid)` (SECURITY DEFINER; responder
  is `deal_responses.responder_id`, owner is `published_deals.user_id`
  via the deal_id join; returns the responder's profile contact only
  when BOTH share flags are true and the caller is the operator or
  one of the two parties).
- `lib/published-deals.ts` + `lib/managed-dispo.ts` — verified writes
  (saved rows selected back). `lib/match-buy-box.ts` — pinned
  matching contract (`dealMatchesBuyBox`, `findMatchingBuyers`,
  `findMatchingDeals`; geography county-or-ZIP, state, type, price,
  rehab tolerance; computed on read only; no email/SMS; `[]` never
  throw; `DealSummary` carries `county`; `findMatchingBuyers`
  attaches `display_name` + `company_name` from the buyer's
  `storefront_profiles` row when one exists).
  `lib/buyer-profile.ts` — VIP contact load/save on `profiles`
  (pre-migration fallback) + `loadBuyerContactForResponse` via the
  RPC. `lib/marketplace-stats.ts` — real published-deals / published-
  buyers counts (honest zeros until real).
- Public routes: `app/deals/page.tsx` + `app/deals/[id]/page.tsx`
  (filters; honest "No deals published yet."; ZIP-only location with
  ZCTA map; demographics/FMR/flood-zone sections; Matching buyers
  (N); respond + mutual-opt-in share buttons; owner
  Unpublish/Republish; no photos), `app/buyers/page.tsx` (published
  buy boxes only; no contact on cards; "Send this buyer a deal"
  links to the dashboard Cash Buyers view — CashBuyersDealBlast has
  no URL route, so no deeper wiring exists), `app/join/page.tsx`
  (role cards; signup preselection via the existing
  `localStorage['ws_pending_role']` mechanism; agent → stored
  referrer), `app/managed-dispo/page.tsx` (request not a booking;
  fee agreed in writing; separate signed agreement; in-app only),
  `app/vip/page.tsx` (signed-in buyers only: private contact +
  buy box + in-app matching deals). `components/PublishDealButton.tsx`
  on the wholesaler's own synced lead rows (`Leads.tsx`, 4-line
  diff). `components/ManagedDispoRequests.tsx` wired into
  `OperatorStats` (operator list + status buttons).
- Dashboard + landing: `app/page.tsx` (build tag Slice 132;
  `MarketplaceLanding` after `<Landing/>`; header band; Marketplace
  quick-links pills; `MarketplaceStatsStrip`), `components/Sidebar.tsx`
  ("Marketplace" dropdown: Off-Market Deals / Cash Buyers / Buyer
  Networks / Managed Dispo), `components/PortalHome.tsx` (card shell
  refresh; Matching deals in BuyerPortal; role label "Seller" →
  "Property owner" as DISPLAY only — stored `'seller'` untouched).
  `components/BuyerNetworks.tsx` gains the publish toggle + ZIPs +
  rehab select + states multi-select.
- Free-stack underwriting (all server-side Next.js API routes, 30s
  timeout, cache, errors quoted verbatim; no Cloudflare Worker):
  `app/api/demographics` (Census ACS — needs `CENSUS_API_KEY`; the
  no-key claim was wrong, the API returns "Missing Key" without
  one), `app/api/fmr` (HUD — needs `HUD_API_TOKEN`), `app/api/flood-zone`
  (FEMA NFHL layer 28, verified live — the `/gis/nfhl/` path is DEAD),
  `app/api/boundary` (Census TIGERweb), `app/api/parcel-boundary`
  (FL cadastral geometry; roll code = DOR + 10), `app/api/broward-record`
  (BCPA GIS, verified live), `app/api/corporate-buyers` (RESEARCH
  lookup, 25 rows, CSV export; Sunbiz manual link-out only).
  `components/PropertyMap.tsx` (Leaflet 1.9.4 via npm + OSM; parcel
  polygon, TIGERweb GeoJSON, Regrid tile toggle default off, zoom 17
  — parcels render only at zoom 15+). Dropped honestly: FHFA HPI (no
  free API — only static downloads), Socrata municipal feed (no city
  verifies), OpenCorporates company check (v0.4 returns HTTP 401
  without a token). No bulk harvesting of roll owners into buyer
  lists. `supabase/functions/match-and-email/index.ts` is file only,
  NOT live, NOT_CONFIGURED (needs `RESEND_API_KEY` + a verified
  sender domain — neither exists; Resend setup is a FOUNDER task
  for later).

### Slice 133 — Buyer offers, POF verification, saved searches, deal attention stats, assignment from a match, SEO, phone check, state-linked counties (3,229), Copy Deal & Open OBL, buy-box criteria, buyer invite link

- `supabase/migrations/20261117140000_slice133_deal_offers.sql` —
  `deal_offers` (deal_id, buyer_id, offer_price > 0, emd_amount ≥ 0
  nullable, closing_date nullable, status pending/accepted/declined/
  withdrawn; buyer INSERT own + SELECT own-or-owner-or-operator,
  owner decide, buyer withdraw, no DELETE policy, no anon access;
  GRANTs in-file).
- `supabase/migrations/20261117141000_slice133_proof_of_funds.sql` —
  private bucket `buyer-pof-documents` (buyer insert/select/delete
  own, operator select all) + `buyer_pof_documents` (one row per
  buyer, status pending/verified/rejected; a buyer can never
  self-verify — the decide policy forces verified rows to carry
  `verified_at` + `verified_by`) + public view `verified_buyer_pof`
  (verified rows only, user_id + verified_at; anon SELECT on the
  view only, no anon access to table or bucket).
- `supabase/migrations/20261117142000_slice133_deal_stats.sql` —
  `deal_views` (RLS enabled, zero anon/authenticated policies — the
  service-role route is the only writer/reader) + `deal_price_history`
  (deal_id, old_price, new_price, changed_at; owner-insert only,
  public read restricted to published deals, operator read).
- `supabase/migrations/20261117143000_slice133_saved_searches.sql` —
  `buyer_saved_searches` (user_id, states/markets/property_types
  text[], min_price, max_price; owner CRUD + operator read, no anon).
- `supabase/migrations/20261117144000_slice133_deal_status.sql` —
  `published_deals.status` (CHECK Active/Under Contract/Sold,
  default Active, idempotent ALTER) + an owner SELECT policy for
  their own rows published or not (coordinator addition — Slice 132
  gave the owner INSERT/UPDATE/DELETE but no SELECT, so an owner who
  unpublished a deal could no longer read their own row to re-publish
  or change its status) + a DB trigger rejecting offer INSERTs on
  deals that are not Active-and-published (coordinator addition —
  the UI block alone cannot stop a direct API caller; depends on
  `deal_offers` from 20261117140000, which runs first).
- `supabase/migrations/20261117145000_slice133_buy_box_criteria.sql` —
  idempotent ALTERs adding `max_arv_pct`, `min_profit`,
  `condition_preferences`, `strategy_preferences`,
  `closing_timeline` to `wholesaler_buy_boxes` (grants already exist;
  no new policies).
- Offers + assignment: `lib/deal-offers.ts` (submit/decide/withdraw,
  verified writes, role checks) + `app/deals/[id]/page.tsx` (offer
  form, money EMPTY by default, "Sign in to make an offer" when
  signed out; owner Accept/Decline; offering buyer Withdraw;
  offers blocked when the deal is not Active — UI + submit handler
  + DB trigger; deal fetches select `status` first and retry
  without it when the migration has not been applied yet, so the
  pages keep working pre-migration). `components/WholesaleContractGenerator.tsx`
  + `app/page.tsx` (localStorage `ws_contract_prefill` handoff,
  consumed once, ownership re-checked, opens the contracts view on
  the assignment tab with the existing `buildAssignmentContract()` —
  no second template; fee never carried, seller name + street
  address never carried — a published deal holds neither).
- POF: `lib/proof-of-funds.ts` + `components/ProofOfFundsUpload.tsx`
  (PDF/PNG/JPG ≤ 10 MB; re-upload returns the row to pending and
  clears any old verification) + `components/ProofOfFundsReview.tsx`
  (wired into `OperatorStats`; Verify/Reject, 1-hour signed URLs
  minted with the operator's own session) + `components/BuyerPofStatus.tsx`
  ("POF verified — <date>" only when verified, nothing otherwise;
  wired into `BuyerNetworks`, `/vip` upload, and `/buyers` cards
  with preloaded verified dates). No bank account numbers displayed.
- Saved searches: `lib/saved-searches.ts` + `/buyers` ("Save this
  search" + Apply/Delete; matching deals shown in the app only, no
  email alerts promised or sent). `/buyers` price filter is now a
  Min/Max range pair so saved criteria match.
- Stats: `app/api/deal-view/route.ts` (service-role GET + POST; one
  counted view per browser session per deal) + `components/DealAttentionStats.tsx`
  (days on market from real `created_at`, responses counted live
  from `deal_responses`, price drops only from recorded history;
  `publishDeal` records the initial price, best-effort; no edit flow
  exists for a published deal's asking price, so drops stay dormant
  until an edit flow calls `recordDealPriceHistory` — never an
  invented prior price). Mounted on `/deals/[id]` before Property
  facts.
- SEO: `/deals` + `/buyers` added to `app/sitemap.ts` (same pattern
  as `/school`); dynamic `/deals/[id]` deliberately not enumerated.
- Phone check (code inspection only — no live render claimed):
  real breakage fixed on `/deals` (300px card grid inside padded
  containers overflowed at 320px → `minmax(min(300px, 100%), 1fr)`),
  same class hardened on `/buyers` + `/join`; `/managed-dispo` and
  `/deals/[id]` fit; long unbroken strings in highlights/notes/comp
  addresses got `overflow-wrap`.
- Counties: `lib/us-counties.ts` is a static module (no runtime
  network call) — 56 codes, 3,229 county-equivalent names (3,235 raw
  rows minus 6 same-named independent cities in VA/MD/MO); Census
  Gazetteer 2024 (3,222 rows: 50 states + DC + PR 78 municipios) +
  Census TIGERweb for GU 1 / VI 3 / AS 5 / MP 4; FL cross-check PASS
  exact 67/67 against the repo's `FLORIDA_COUNTIES`, and Florida
  keeps the repo's verified list (imported, not copied); CO 64 / CA
  58 / TX 254 / PR 78 all match TIGERweb; no county name invented,
  no count adjusted by hand. The five territory codes (PR/GU/VI/AS/MP)
  are selectable in the shared state list. `components/StateCountyFilter.tsx`
  (shared state-linked Market filter) drives the buy box, `/buyers`
  filters, `/vip`, both deal-blast county filters, and the
  cash-buyer form's `target_counties`; multi-state → union; "All
  markets" stays the default; a state with no loaded list shows
  "counties not loaded yet". Known limitation (pre-existing model):
  markets are bare county names with no state attached, so a name
  shared by two states is one entry in a multi-state union.
  `PropertyLookup` stays FL-only (untouched except the research-row
  invite button). The `match-buy-box.ts` `storefront_profiles`
  select was FIXED (it read `user_id`; the real key per Slice 124
  is `wholesaler_id` — matched buyers' names had silently stayed
  null).
- Buy-box criteria: `lib/buy-box.ts` (`CONDITION_OPTIONS` 5 pinned,
  `STRATEGY_OPTIONS` 7, `CLOSING_TIMELINE_OPTIONS` 4; all empty by
  default) + `lib/match-buy-box.ts` (each field applies only when
  set; empty = no constraint) + form inputs in `BuyerNetworks` and
  `/vip` + criteria shown on `/buyers` cards ("not provided" when
  blank). "Broadcast to My BYOK Buyers" + send-invite-blast were NOT
  built (broken paste code; Slice 134 builds the provider store +
  dispatcher first).
- Buyer invite: `/join` reads `?role=buyer` from the URL query
  (plus `?ref=` stashed as `ws_invite_ref`, nothing reads it yet, no
  attribution claimed); `lib/invite-link.ts` + `components/BuyerInviteLink.tsx`
  (Copy invite link + QR in the verified goqr.me format, link shown
  as text, `?ref=<own public_slug>` when saved); "Copy invite link"
  in the Cash Buyers view, `BuyerNetworks`, and each corporate-buyer
  research row (no auto-email — roll data has no emails, no provider,
  no consent); "Get deals like this — register your buy box" CTAs on
  `/deals`, `/deals/[id]`, `/buyers`; honest label "They register
  themselves — one tap on your link."
- Cross-post + status: `lib/deal-cross-post.ts` (pure formatter from
  real `published_deals` columns only — never a street address;
  blanks "not provided") + `components/CopyDealToOblButton.tsx`
  (copies the summary, then opens openbuyerslist.com for hand
  cross-posting, labeled "does not auto-post"; owner-only) +
  `components/DealStatusBadge.tsx` + `lib/deal-status.ts` +
  `components/MyPublishedDeals.tsx` (new table in the Leads view,
  where deals are published from; status dropdown + copy button +
  detail link). The paste's standalone index.html + SQL were
  rejected: no `public.deals` table, no anon SELECT `USING(true)`
  policy. Build tag reads Slice 133.

### Slice 137 (part A) — AI Wholesale Copilot Edge Function + provider store (file only, NOT live)

- `supabase/functions/ai-wholesale-copilot/index.ts` — Edge Function,
  file only, **NOT deployed** (owner step after push):
  `supabase functions deploy ai-wholesale-copilot`. **BYOK only, no
  shared key**: it reads the CALLER's own Gemini or Groq key from
  their own `wholesaler_provider_settings` row via the service-role
  client; it never reads a global `GEMINI_API_KEY` / `GROQ_API_KEY`
  secret (none exists), never takes a key from a request param, and
  never logs a key. `verify_jwt` is ON and the caller is resolved
  with `supabase.auth.getUser(token)` — no `user_id` is ever trusted
  from the request body (the body is only `{ question, deal_context? }`).
  Gemini (default) calls `POST
  https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
  with the key as `?key=`; Groq calls `POST
  https://api.groq.com/openai/v1/chat/completions` with Bearer auth
  and model `llama-3.3-70b-versatile`. Both use temperature 0.4 and
  800 max output tokens. The system prompt covers MAO = ARV x 0.70 -
  repairs - wholesale fee, seller objection handling, SMS/email
  pitches to cash buyers and Realtors, creative finance (Subject-To,
  Seller Finance, Novations) and Florida assignment contracts
  explained plainly — concise, practical, copy-paste ready; it never
  invents prices, people, or legal advice beyond general
  information, and never asks for or repeats sensitive personal data
  (no SSNs, no seller phone numbers). Honest errors, no retries: no
  key configured → 400 "AI not connected — add your own free Gemini
  or Groq key in My Providers" (never a fake answer); provider 429 →
  429 "free-tier limit reached — check your quota in AI Studio /
  Groq console and try again later" (never retried in a loop); other
  provider errors are quoted verbatim in the message.
- `supabase/migrations/20261117160000_slice137_provider_settings.sql` —
  the unified provider store `wholesaler_provider_settings` (one row
  per wholesaler: `UNIQUE(user_id)`; `ai_provider` gemini/groq,
  default gemini; `gemini_api_key` + `groq_api_key` as plain TEXT —
  never claimed "encrypted"; owner-only RLS, no anon access; GRANTs
  to `authenticated` + `service_role` in the same file) + the
  SECURITY DEFINER RPC `get_ai_key_status()` (one row for the caller
  only: provider, has-each-key booleans, each key masked to first 4
  + '…' + last 4 chars or null — client code never reads a full key;
  GRANT EXECUTE to `authenticated` in the same file). **Not live
  until the migration is applied, a key is entered, and the function
  is deployed.** Slice 134 will ADD the skip-trace / email / SMS
  columns to this same table — no second store; until then `/api/send`
  and the skip-trace functions keep failing closed (`not_configured`),
  because the columns they select do not exist yet.
- **Where to get a free key:** Google AI Studio —
  `https://aistudio.google.com`; Groq console —
  `https://console.groq.com/keys`. **Honest limits:** Gemini's free
  tier is rate-limited with a daily ceiling that varies by project —
  check AI Studio; Groq's free tier has per-model caps — check the
  Groq console Limits page; both return 429 at the ceiling, and the
  function reports that honestly instead of retrying.

### Slice 138 — RLS infinite-recursion fix (funding_requests / lender_boxes)

- **The bug (found live Nov 17, 2026 ~15:45 EST):** the signed-in
  dashboard's Capital & Lending Partner Desk shows `infinite
  recursion detected in policy for relation "funding_requests"
  [42P17]`. This is very likely the real cause behind the
  long-standing "Could not load packets." failure — Slice 136 only
  surfaced the database's error message; it did not fix the query.
- **The loop:** the `lender_boxes` policy "requester reads matched
  lender boxes" ran an EXISTS subquery directly against
  `funding_requests`, while the `funding_requests` policies
  "matched lenders read iso funding requests" and "matched lenders
  update iso funding request status" ran EXISTS subqueries directly
  against `lender_boxes` — a cross-table policy loop.
  `is_operator()` is SECURITY DEFINER and reads only `profiles`,
  so it is NOT the loop and is untouched.
- **The fix** (`supabase/migrations/20261117170000_slice138_rls_recursion_fix.sql`,
  apply after the Slice 138 deploy): two SECURITY DEFINER helpers,
  `requester_has_matching_iso_request(uuid, text[], text[])` and
  `lender_has_matching_box(uuid, text, text)`, each `STABLE` with
  `set search_path = public`, returning a boolean only. The three
  affected policies are dropped and re-created to call the helpers
  instead of subquerying the other table. Matching semantics are
  preserved exactly (verified partner + agreement accepted + state
  covered + financing type offered, ISO-network track only). GRANT
  EXECUTE on both functions to `authenticated` is in the same file.
  No other policy, table, column, or grant is changed.
- **Live re-check DONE 16:01–16:02 EST Nov 17, 2026:** signed in as a
  lender, the Capital & Lending Partner Desk shows no recursion text and
  loads normally with its honest empty state (Opt-In Deal Packets 0,
  "No matched packets yet", "No lender boxes registered yet"). The fix is
  proven live — CLOSED.

### Slice 139 — Amazon Connect softphone, BYOK (NOT live — no instance exists yet)

- **BYOK only, no shared instance:** each wholesaler brings their OWN
  Amazon Connect instance and pastes their OWN instance CCP URL into
  My Providers; it is stored on their own
  `wholesaler_provider_settings` row as `connect_ccp_url`
  (`supabase/migrations/20261117180000_slice139_connect_ccp_url.sql`,
  adds the column only — apply after the Slice 139 deploy).
  `components/MyProviders.tsx` saves/loads that URL with a targeted
  select of `connect_ccp_url` only. The platform runs no Connect
  instance of its own and shares no number across wholesalers.
- **How the pieces talk (window events only, no imports between
  them):** `components/ProbateLeads.tsx` (a "Call" button next to
  each skip-traced decision-maker phone) and
  `components/CommsCenter.tsx` (a "Call via Connect" button in the
  blocklist-cleared channel row, next to the existing phone-app Call
  link) dispatch `new CustomEvent('ws:connect-call', { detail: {
  phone } })` on a human tap — human tap only, never auto-dial, and
  the button renders only where a real phone number is actually
  shown. The softphone (`components/ConnectDialer.tsx`) listens for
  that event and dials through the saved CCP URL; when the call ends
  it dispatches `ws:post-call` with `{ phone, durationSec }`.
  `components/PostCallModal.tsx` listens for that event and opens the
  "Post-Call Seller Summary" modal (asking price / debt, ARV &
  repairs, motivation / timeline / notes — all empty by default, no
  dollar figures anywhere). Its "Analyze Offer & Draft Follow-Up"
  button calls `openCopilot(context, autoQuestion)` from
  `lib/ai-copilot.ts` with the exact question "Based on these call
  notes, calculate my Maximum Allowable Offer (MAO), suggest a
  negotiation angle, and write a short follow-up SMS I can send them
  right now." The context is built from the three note fields only —
  the phone number stays in the modal meta line and is NEVER sent to
  the AI (free-tier prompts may be used for training). Mount the
  modal once, in `app/layout.tsx` next to `<AiCopilot />`:
  `import PostCallModal from '../components/PostCallModal';` +
  `<PostCallModal />`.
- **Owner setup steps (each wholesaler, in AWS + the app):** 1) an
  AWS account; 2) create an Amazon Connect instance in the AWS
  Console; 3) claim a phone number in that instance; 4) in the
  instance settings, approve the app origins
  `https://wholesalingos.thefeetwashers.com` and
  `https://wholesalingos.vercel.app` (the CCP / Streams embed refuses
  any origin that is not approved); 5) copy the instance CCP URL and
  paste it in My Providers; 6) apply the Slice 139 migration above.
- **Honest limits:** no Connect instance exists yet, so nothing is
  live until a CCP URL is saved AND the instance exists with the
  domain approved — until then the Call buttons dispatch an event no
  dialer answers and no call is placed. The softphone needs the
  Streams library and a live instance; neither is verified here.
- **Recording / transcription is intentionally NOT built.** Florida is
  two-party consent for recording (Fla. Stat. §934.03) — the call is
  not recorded, not transcribed, and no recording consent prompt
  exists. The post-call notes are typed by the wholesaler after the
  call, nothing more.

### Slice 140 — Founder billing exemption (the founder never pays)

- **The decision (founder, Nov 17, 2026):** thefeetwashers@gmail.com
  is the founder's own account — the founder does NOT pay the $150/mo
  fee, never sees a trial-expired / pay prompt, and must never be
  charged or status-changed by Stripe. The founder's
  `saas_subscriptions` row currently reads `trialing` with
  `trial_ends_at` Jan 27, 2027; after that date the banner would have
  said "trial expired — then $150/mo". This slice neutralizes that.
- **The flag:** `supabase/migrations/20261117190000_slice140_founder_billing_exemption.sql`
  adds `is_founder_exempt boolean NOT NULL DEFAULT false` to
  `public.saas_subscriptions` and sets it true on the founder's row
  only (matched by the profiles email literal `is_operator()` uses —
  the one place the email appears; it appears nowhere in app code).
  The existing row-based policies from migration 20261115170000
  already cover the new column, so no new policies, grants, or
  tables. No new `plan_status` value. Apply after the Slice 140
  deploy, after the Slice 139 migration, in timestamp order.
- **What the founder sees:** `components/SubscriptionBanner.tsx`
  reads the flag and renders a green "Founder account — no
  subscription fee. You never pay the $150/mo." state with NO
  "Activate Plan" button, NO trial countdown, NO "Manage Billing"
  button, whatever `plan_status` or `trial_ends_at` says. Every other
  wholesaler's banner is unchanged. `components/AdminSaaSDashboard.tsx`
  shows a green "Founder — exempt" pill on the exempt row.
- **What Stripe can never do to the founder:** `app/api/stripe/webhook/route.ts`
  and `supabase/functions/stripe-billing/index.ts` both check the flag
  (service-role client) before any write, in EVERY branch
  (checkout.session.completed, subscription created/updated/deleted,
  invoice.payment_failed) — an exempt row gets NO
  `saas_subscriptions` write of any kind and NO
  `profiles.subscription_status` write, and the skip is logged with
  the subscription id. The Edge Function's `create_checkout` refuses
  an exempt caller with 403 before any Stripe call, so no Stripe
  customer or Checkout session is ever created for the founder. If
  the flag cannot be read (a failed query), both files fail CLOSED
  to exempt — the write is skipped and logged — because a skipped
  write is recoverable (Stripe retries webhooks) while a write
  landing on the founder's row is the exact harm the exemption
  exists to prevent. Non-exempt rows behave exactly as before.
- **Honest limits:** Stripe is NOT connected (no account, product,
  or price ID), so no live Stripe event has ever tested the skip —
  it is verified by code reading only until Stripe connects. The
  exemption survives a future webhook event by design; it does not
  depend on the banner.

### Other

- `lib/ledger.ts` — the slice ledger (code-only verified vs live proof
  deferred, per slice). Read it before touching a slice.
- `lib/scripts-data.ts` — the approved outreach wording (probate-call,
  probate-letter, foreclosure-call, and the rest). Modals reuse these
  templates; never invent new promises in outreach copy.

## 3. Migrations — order and the commit-pinned URL rule

Already applied (Nov 15–16, 2026 — do not re-run unless the database was reset):

| File | Slice |
| --- | --- |
| `20261115090000_capital_lending_lender_role.sql` | Capital & Lending |
| `20261115091500_capital_lending_fee_exact.sql` | Slice 120 |
| `20261115110000_winwin_ecosystem.sql` | Slice 122 |
| `20261115120000_slice123_leads_columns.sql` | Slice 123 |
| `20261115130000_slice124_storefront.sql` | Slice 124 |
| `20261115140000_slice125_seller_firsts.sql` | Slice 125 |
| `20261115150000_probate_leads.sql` | Slice 127 |
| `20261115160000_cash_buyers.sql` | Slice 128 |
| `20261115170000_saas_subscriptions.sql` | Slice 129 |
| `20261115180000_leads_owner_contact.sql` | Slice 129 |

New in this push (Slices 130–140 — status per row):

| File | Contents |
| --- | --- |
| `20261117090000_slice130_operator_visibility.sql` | `scout_leads.w9_received` + `w9_received_at` + W-9-before-paid CHECK; `funding_requests.interest_rate` + `loan_term_months`; `problem_reports` table + RLS |
| `20261117123500_grant_authenticated_app_tables.sql` | Grants fix (Nov 17) — GRANTs to `authenticated` + `service_role` on the Slices 118–130 app tables, incl. `funding_requests` + `lender_boxes`; applied + verified live Nov 17, 2026, 12:40–12:42 EST |
| `20261117124100_buyer_networks_buy_box.sql` | `wholesaler_buy_boxes` table (one buy box per wholesaler) + owner/operator RLS + GRANTs to `authenticated` and `service_role` in the same file |
| `20261117130000_slice132_marketplace_tables.sql` | `published_deals` + `deal_responses` + `managed_dispo_requests` tables + RLS + GRANTs (incl. anon SELECT on published deals only) in the same file |
| `20261117131000_slice132_buy_box_published.sql` | `wholesaler_buy_boxes.published` + `zip_codes` + `rehab_tolerance` + `states` + `email_alerts_opt_in`; minimal public read policy + anon SELECT grant |
| `20261117133000_slice132_buyer_contact_profiles.sql` | `profiles.contact_name` + `contact_phone` + `contact_private` (ALTER only) + mutual-opt-in RPC `get_buyer_contact_for_response(uuid)` |
| `20261117140000_slice133_deal_offers.sql` | `deal_offers` table (price/EMD/closing date, status pending/accepted/declined/withdrawn) + RLS + GRANTs in the same file |
| `20261117141000_slice133_proof_of_funds.sql` | Private bucket `buyer-pof-documents` + `buyer_pof_documents` table + public view `verified_buyer_pof` (verified rows only) + RLS + GRANTs in the same file |
| `20261117142000_slice133_deal_stats.sql` | `deal_views` (service-role route is the only writer/reader) + `deal_price_history` tables + RLS + GRANTs in the same file |
| `20261117143000_slice133_saved_searches.sql` | `buyer_saved_searches` table (owner CRUD + operator read, no anon) + GRANTs in the same file |
| `20261117144000_slice133_deal_status.sql` | `published_deals.status` (Active/Under Contract/Sold, default Active) + owner SELECT policy for own rows + DB trigger rejecting offer INSERTs on non-Active deals |
| `20261117145000_slice133_buy_box_criteria.sql` | `wholesaler_buy_boxes.max_arv_pct` + `min_profit` + `condition_preferences` + `strategy_preferences` + `closing_timeline` (idempotent ALTERs) |
| `20261117150000_slice135_realtor_pocket_listings.sql` | Slice 135 — `realtor_pocket_listings` table + `submit_realtor_pocket_listing` function; applied + verified live Nov 17, 2026 |
| `20261117151000_slice136_owner_contact_reveal.sql` | Slice 136 — mutual-opt-in RPC `get_owner_contact_for_response(uuid)` (mirror of `get_buyer_contact_for_response`, same both-flags + party/operator gate) + GRANT EXECUTE to `authenticated` in the same file; 52 lines; Applied + verified Nov 17, 2026 (15:26–15:28 EST) |
| `20261117160000_slice137_provider_settings.sql` | Slice 137 (part A) — unified provider store `wholesaler_provider_settings` (AI columns only: `ai_provider`, `gemini_api_key`, `groq_api_key`, plain TEXT) + SECURITY DEFINER RPC `get_ai_key_status()` (masked keys only) + owner-only RLS + GRANTs to `authenticated` + `service_role` in the same file; Applied + verified Nov 17, 2026 (15:46–15:48 EST); skip-trace / email / SMS columns come with Slice 134, on this same table |
| `20261117170000_slice138_rls_recursion_fix.sql` | Slice 138 — RLS infinite-recursion fix: SECURITY DEFINER helpers `requester_has_matching_iso_request(uuid, text[], text[])` + `lender_has_matching_box(uuid, text, text)` (boolean only, `set search_path = public`) + the three affected policies dropped and re-created to call them (matching semantics unchanged) + GRANT EXECUTE to `authenticated` in the same file; Applied + verified Nov 17, 2026 (15:59–16:01 EST) |
| `20261117180000_slice139_connect_ccp_url.sql` | Slice 139 — Amazon Connect softphone (BYOK): `wholesaler_provider_settings.connect_ccp_url` (text, nullable); no new policies/grants/tables; Applied + verified Nov 17, 2026 (16:14–16:16 EST) |
| `20261117190000_slice140_founder_billing_exemption.sql` | Slice 140 — founder billing exemption: `saas_subscriptions.is_founder_exempt` (boolean, NOT NULL DEFAULT false) + UPDATE setting it true on the founder's row only (profiles email literal matching `is_operator()`); no new policies/grants/tables; Applied + verified Nov 17, 2026 (16:23–16:26 EST) |

Slice 126 needs **no migration** (code-only CO_NO fix).

**How to run a migration (the Slice 122 lesson):** run it in the Supabase
SQL editor as `thefeetwashers@gmail.com`, pasting from the **commit-pinned
raw URL** — `https://raw.githubusercontent.com/thefeetwashers/Wholesaling-OS/<full-commit-sha>/supabase/migrations/<file>`
— and verify the file's identity (line count / key markers) before pasting.
The plain main-branch raw URL once served a stale cached copy (813 lines
vs the fixed 818) and caused a false failure. Never let a policy or
function reference a table created later in the same file.

## 4. Routes (real)

- `/` — dashboard (`app/page.tsx` + PortalHome views; Probate Leads,
  Contracts, and Cash Buyers join the existing navigation — there is no
  `app/dashboard/page.tsx`).
- `/sell/[slug]` — public wholesaler storefront (2-step form).
- `/sell/[slug]?case=2026CP001433` — same storefront with a probate tag;
  the case number lands on `leads.probate_case_number`.
- `/track/[token]` — private seller status tracker.
- `/school` — 7-day bootcamp (Day 7 quiz 4/5 = Verified Operator badge).
- `/deals` — public off-market deals (published deals only; ZIP-only location; no photos).
- `/deals/[id]` — public deal detail (facts, comps, highlights, ZCTA map, demographics/FMR/flood zone, Matching buyers, respond + mutual-opt-in).
- `/buyers` — public cash buyers directory (published buy boxes only; no contact on cards).
- `/join` — role picker (Buyer / Wholesaler / Real estate agent / Property owner / I'm multiple) routing to signup with the role preselected.
- `/managed-dispo` — operator's managed disposition service (request form, in-app only).
- `/vip` — signed-in Cash Buyer VIP Portal (private contact + buy box + in-app matching deals).
- `/api/demographics`, `/api/fmr`, `/api/flood-zone`, `/api/boundary`, `/api/parcel-boundary`, `/api/broward-record`, `/api/corporate-buyers` — server-side underwriting/research routes (see §2 Slice 132).

## 5. Skip-trace Edge Function — BYOK, no sandbox, no shared key

There is **no sandbox / test mode**. No fake phone numbers (`(772) 555-…`)
or `@example.com` emails are ever written into real leads, in any mode,
for any reason.

**BYOK provider model (founder decision, Nov 16, 2026): EACH wholesaler
brings their OWN skip-trace, email, SMS, and billing accounts** — because
each wholesaler manages their own storefront. The platform NEVER shares one
provider across wholesalers. The function therefore resolves the provider
key **per calling wholesaler** (`getProviderKey(userId)` in the function,
reading that wholesaler's own settings) — never from a single global
secret. Do not wire a global `BATCHDATA_API_KEY` secret: a shared key
would violate BYOK.

- The per-wholesaler settings store is the `wholesaler_provider_settings`
  table created by Slice 137's migration
  (`20261117160000_slice137_provider_settings.sql`, applied Nov 17, 2026 —
  see §2). Its keys are plain TEXT columns, never claimed "encrypted".
  The skip-trace columns (`batchdata_api_key`, `google_api_key`,
  `google_cse_id`) are NOT in that migration — Slice 134 adds them to
  this same table. Until Slice 134 lands, no skip-trace provider is
  connected, so the function returns
  `{ success: false, mode: 'not_configured' }` and writes **nothing**.
  The UI falls back to manual entry.
- Outreach and the deal blast already open the wholesaler's own mail/SMS
  app (copy + `mailto:`/`sms:`) — that IS the BYOK behavior for now. Do
  not add any platform-sent email/SMS. Per-wholesaler connected sending is
  a future slice after the founder picks providers.
- The **live branch is DISABLED** (`BATCHDATA_LIVE_ENABLED = false`) and
  labelled unverified: BatchData's endpoint was verified from their own
  docs (POST `https://api.batchdata.com/api/v3/property/skip-trace`,
  `{ "requests": [{ "propertyAddress": { "street", "city", "state", "zip" } }] }`,
  Bearer auth), but the v3 **response field names are not fully verified**,
  so nothing is sent or mapped until they are confirmed at
  `developer.batchdata.com`. Do not present the live branch as ready.
- The function verifies the caller's JWT and allows the update only if
  `lead.user_id` equals the caller or the caller is the operator
  (otherwise 403). The key resolved is the **lead owner's** key (the
  wholesaler whose account pays for the lookup). It never defaults a city
  — city/state/zip are passed only when actually known.
- Deploy is an **owner step after push** (file only, NOT deployed):
  `supabase functions deploy skip-trace-decision-maker`. There is no
  global secret to set.

### Google Skip-Trace function (Slice 129) — same BYOK rule, different API

- `supabase/functions/google-skip-trace/index.ts` — file only, **NOT
  deployed**, NO keys. It verifies the caller JWT and allows the lookup
  only when the lead belongs to the caller or the caller is the operator
  (403 otherwise). Keys resolve **per calling wholesaler** via
  `getGoogleKeys(userId)` (the `wholesaler_provider_settings` store
  created by Slice 137's migration — NOT yet applied, and its
  `google_api_key` / `google_cse_id` columns come with Slice 134, so
  the lookup returns null today). It NEVER
  reads a global `GOOGLE_SEARCH_API_KEY` / `GOOGLE_CSE_ID` secret. No
  provider → `{ success: false, mode: 'not_configured' }`, writes
  nothing; the modal falls back to the Google link + manual entry.
- **The live branch is DISABLED** (`GOOGLE_LIVE_ENABLED = false`) and
  labelled unverified — and it must stay that way: Google's own docs
  (developers.google.com/custom-search/v1, verified Nov 16, 2026) confirm
  the endpoint (`GET https://customsearch.googleapis.com/customsearch/v1`,
  params `key`, `cx`, `q`, `num`) and the pricing (100 free/day, $5 per
  1,000 after) — but the overview page also states the API **"is not
  available for new customers" and is discontinued January 1, 2027**.
  A new key cannot be provisioned, so Method 2 cannot be newly set up.
  **Method 1 — the google.com lookup link — is the working path.**
  Do not present Method 2 as provisionable, and do not re-enable the
  live branch without a verified, provisionable API.
- Phones/emails are extracted ONLY by regex from the title + snippet
  Google actually returned. No fake data, no sandbox mode.
- Deploy is an **owner step after push** (file only, NOT deployed):
  `supabase functions deploy google-skip-trace`. There is no global
  secret to set — and no provider to set one for until the founder
  picks providers (§5, BYOK).

## 6. The workflow that closes the loop (Nov 16 gap fixes)

- **Excel upload:** both upload paths accept `.csv`, `.xlsx`, `.xls`
  (file inputs say "Upload CSV or Excel"). The spreadsheet reader takes
  the FIRST sheet only and feeds the SAME pipeline as CSV — header
  auto-mapping, dedupe, and the parser are unchanged. Verified: the
  founder's `SearchResults__3.csv` converted to `.xlsx` parses to the
  same 27 cases / 26 OPEN / 1 CLOSED / 7 Pro Se / 0 without a
  decision-maker.
- **Address-optional distress import:** a case list with no address
  column (the founder's foreclosure file: `caseid, Case Number,
  Description, Case Type, Entered Date, TotalFee`) still imports. Each
  row becomes a lead with the case number + parties (defendant from
  `Description`, the party after `-VS-`), an empty property address
  (never invented), and the flag "Address needed — next step: Clerk case
  lookup → appraiser mailing address", shown on the Leads row. Verified:
  all 160 rows import flagged (141 × `2026CA`, 19 × `2026CC`).
- **Probate ↔ seller cross-link:** each probate row shows whether its
  petitioner already submitted through the storefront — "Seller submitted
  — `<seller_status>`" (the lead's real `seller_status`) or "No submission
  yet". Read-only lookup on `leads.probate_case_number`; no new table.
- **Contact history:** `probate_lead_activity` (append-only; owner +
  operator RLS). A row is written ONLY by the outreach modal's "I sent
  this" button (sms/email) and the print modal's "I mailed this" button
  (mail). Copying, opening an app, or printing alone writes nothing. The
  probate row shows "Last contact: <date> via <channel>".
- **Export:** the Probate Leads desk has a "Download CSV" button exporting
  the CURRENT filtered view (same columns as the parsed record file).
  CSV only — it opens in Excel as-is. Nothing the filter hides is exported.
- **No auto-send anywhere:** outreach is copy + `sms:`/`mailto:` only;
  the deal blast is copy + BCC mailto only. The app never auto-dials,
  auto-texts, or auto-emails.

## 7. Environment variables — names only, never values

Already set in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (read by
  `lib/supabase.ts`).
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only, used by the API routes.
  Never in the browser, never in this file as a value.

Honestly unset (features that stay off until they are set):

- `NEXT_PUBLIC_INSURANCE_PARTNER_URL` — unset; no insurance partner link
  renders and no insurer is named.
- No mail/print provider key — mail sending is not live (Send disabled).
- No skip-trace provider key — the Edge Functions answer `not_configured`
  (see §5). No global provider secret exists (BYOK, §5).
- No Stripe keys — `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_150_MONTHLY`,
  `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` are all unset (see
  §10). The stripe-billing function answers `not_configured` and does
  nothing until they are set.
- **Billing: founder researching — decision pending.** Whether billing
  means each wholesaler's own Stripe account or the $150/mo platform
  subscription each wholesaler pays is unresolved (the founder wrote
  "billing (Stripe?)" with a question mark). The files for the platform
  model now exist (`saas_subscriptions` + `stripe-billing`, §10) but
  NOTHING is live: no Stripe account, no product/price, no deployed
  function, no money moves. Do not claim Stripe billing is live. The
  $150/mo platform price itself is locked (see §9).

Never write a real key or secret into this README, into chat, or into the
repo. Do not commit `.env`.

## 8. Go-live checklist (current state: Slices 135–140 live; Slice 141 audit fixes local only)

1. Slices 135–140 are ALL LIVE on both `wholesalingos.thefeetwashers.com` and
   `wholesalingos.vercel.app` (deploy confirmed Nov 17, 2026 on both domains
   for each slice). Confirm the build tag reads **Slice 140** on both domains.
   Slice 135 (commit `f10bab5`, deploy 14:46 EST) — Distressed Finder,
   Parcel Enricher, Agent Pocket Listings, API docs. Slice 136 (commit
   `c26b6a8`, deploy 15:26 EST) — audit fixes. Slice 137 (commit `77e1212`,
   deploy ~15:46 EST) — AI Copilot. Slice 138 (commit `88a1aa3`, deploy
   ~15:58 EST) — RLS recursion fix. Slice 139 (commit `e871367`, deploy
   16:14 EST) — Connect softphone. Slice 140 (commit `e0d487a`, deploy
   16:23 EST) — founder billing exemption. Slice 141 audit fixes are local
   only — not pushed, not deployed.
2. Migrations applied live: Slice 133's six (`20261117140000`–
   `20261117145000`) and Slice 135's (`20261117150000`), verified Nov 17,
   2026 — plus Slice 136's (`20261117151000`, 15:26–15:28 EST), Slice 137's
   (`20261117160000`, 15:46–15:48 EST), Slice 138's (`20261117170000`,
   15:59–16:01 EST), Slice 139's (`20261117180000`, 16:14–16:16 EST), and
   Slice 140's (`20261117190000`, 16:23–16:26 EST); see §3 for the full
   table. The **legacy-schema dump arrived Nov 17, 2026** — both dumps are
   done, saved at `~/workspace/legacy-schema-dump-20261117.md` (re-dump
   15:07 EST: 33 policies verbatim, 256 grant rows, 4 function
   definitions). Do not invent its contents or apply anything for it
   until the legacy-schema migrations are written from it (a later slice,
   not this one).
3. Stripe: **NOT connected** — no Stripe account, no product or price ID,
   no secrets set, and the `stripe-billing` function is NOT deployed.
   Do not claim billing is live. The $150/mo platform price itself is
   locked (see §9); the billing-model decision (each wholesaler's own
   Stripe account vs the platform subscription) is still open (§10).
4. No email/SMS provider connected — no Resend key, no Twilio keys; the
   `match-and-email` function is NOT deployed (`not_configured`); the app
   never auto-sends. Per-wholesaler connected sending waits on Slice 134
   (BYOK provider store + dispatcher) and the founder picking providers.
5. No proof of funds verified yet — no buyer POF document has been
   verified by the operator, so the `verified_buyer_pof` view is empty
   until the first real verification happens.
6. Lender packets: the lender desk's packet load failed live and the old
   code swallowed the database's error behind the generic "Could not load
   packets." Slice 136 surfaces the real error in code (see
   `lib/funding.ts` `postgrestError` + `components/LenderDashboard.tsx`
   `readableError`). **Live check done after the Slice 136
   deploy:** the desk was opened signed in as a lender and the surfaced
   message was read before any fix was guessed. Two often-suspected causes are already
   ruled out by the Nov 17 record: the grants migration `20261117123500`
   was applied + verified live 12:40–12:42 EST, and the Slice 130 columns
   migration `20261117090000` was applied + verified live 05:04–05:07 EST —
   and the packets failure was observed ~14:03 EST, after both were live.
   Update Nov 17 ~15:45 EST: the surfaced message turned out to be an
   RLS infinite recursion (`funding_requests` [42P17]) — a cross-table
   policy loop between `lender_boxes` and `funding_requests`. Slice 138
   fixed it with SECURITY DEFINER helpers (see the Slice 138 section
   above), its migration applied + verified 15:59–16:01 EST, and the
   live re-check PASSED 16:01–16:02 EST: signed in as a lender, the
   Partner Desk shows no recursion text and loads normally with its
   honest empty state. CLOSED — do not re-open this item unless the
   error reappears.
   Confirm in the Supabase SQL editor with:
   `select has_table_privilege('authenticated', 'public.funding_requests', 'SELECT');`
   and `select column_name from information_schema.columns where table_name = 'funding_requests';`
7. First-live-proofs still outstanding (Slices 133 + 135 — none faked):
   first real offer → accept → assignment draft; first POF upload →
   operator verify → badge; first counted deal view; first saved search;
   first buy-box criteria save + match; first invite-link registration;
   first cross-post copy; first status change; first Distressed Finder
   query + save-to-leads; first JV submit; first agent pocket submission +
   approve & promote; first parcel enrich run on a real county record;
   first CSV exports.
8. Already proven live (no need to re-run unless the database was reset):
   Mode B parcel lookup (parcel `494125000190`, Broward, returns the
   Lauderdale Lakes parcel, not Duval, not `[]`); probate import counts
   (**27 cases, 26 OPEN, 1 CLOSED (`2026CP001398`), 7 Pro Se, 0 without a
   decision-maker**); storefront `?case=2026CP001433` tag landing on
   `leads.probate_case_number`; contracts print gate (no print until
   price/fee entered); cash-buyer blast copy (never auto-sent); the
   distress importer accepting the 160-row foreclosure file with all rows
   flagged "address needed"; Google Lookup showing the honest
   `not_configured` message with no provider connected.

## 9. Operating rules

- **National scope (founder, Nov 16, 2026):** the ambition is all 50 states
  + US territories, 3,200+ counties — NOT Florida-only. The **data layer is
  Florida-only TODAY**: a state/county joins only after its real service URL
  is verified live (Slice 123 registry rule; Texas has no statewide parcel
  server). Do not claim national parcel lookup. Expansion is county-by-county
  after live verification. County is a **text field everywhere**
  (`probate_leads.county`, `leads.county`) — never hardcode St. Lucie as the
  only county; the parser, storefront, and contracts already work for any
  county. The appraiser link is per-county from the verified presets
  (Slice 129: `lib/floridaCountyPresets.ts` — St. Lucie → paslc.gov,
  Palm Beach → pbcpao.gov, Miami-Dade → miamidadepa.gov, and so on);
  a county with no preset shows NO appraiser link until one is verified
  and added.
- **REAL ONLY:** no fake businesses, people, lenders, vendors, listings,
  prices, reviews, ratings, verification, stats, or outcomes. Honest empty
  states. Nothing is claimed live until it is actually applied and tested.
- **Push / deploy pattern:** GitHub push (approval card — the user taps it)
  → Vercel auto-deploys. Operator account: `thefeetwashers@gmail.com`
  (owner: Erna Julien). Supabase project ref `nabztcwabkqhxyxcxarx`
  (org "THE FEET WASHERS", Free plan). Sign-in as thefeetwashers@gmail.com
  is via the linked GitHub account. `list_projects` returns 403 for scope
  `wholesaling-os` — that blocks Muse listing projects/logs only, NOT
  deploys.
- **Pricing (locked):** 90 days free, then $150/month for wholesalers only.
  Buyers, sellers, title companies, referrers, and lenders are free. No
  per-deal cut, no percentage of assignment fees.
- **No named partners:** New Century Lending, GoKapital, LendingOne,
  Steadily, NREIG are NOT partners — never list or link them.
- **Compliance:** manual, user-initiated outreach only — no auto-dialing,
  no scraping, no auto-messaging. TCPA consent checkbox on the sell form
  (unchecked by default). Florida is two-party consent for recording
  (Fla. Stat. §934.03). All contract templates carry attorney-review
  labels — they must be reviewed before execution; they are not
  attorney-reviewed. Company voice: "we are a company that purchases
  property" — never claim to be the bank, court, or a lawyer; never
  promise to stop a foreclosure; never quote a price on the first call;
  never mention the assignment fee to a homeowner; stop on request.
- **Domain discipline:** WholesalingOS = `wholesalingos.thefeetwashers.com`.
  `thefeetwashers.com` is the home-care site — never point a WholesalingOS
  feature at it.

## 10. SaaS Admin + Stripe billing (Slice 129 — files only, NOT live)

**Nothing here collects money.** There is no Stripe account yet (the
founder is researching providers), no product or price in Stripe, no
secrets set, and the `stripe-billing` Edge Function is NOT deployed.
The SubscriptionBanner shows "Billing setup pending — the operator is
setting up Stripe" instead of opening a checkout while that is true.

- `saas_subscriptions` (migration `20261115170000`): one row per
  wholesaler — `user_id` UNIQUE, `plan_status` trialing/active/past_due/
  canceled (default `trialing`), `trial_ends_at` default NOW() + 90
  days, `monthly_rate` default 150.00, `stripe_customer_id`,
  `stripe_subscription_id` (unique, so the webhook upsert has a key).
  RLS: owner reads/updates only their own row; the operator reads all
  rows via `public.is_operator()` (NOT an `auth.jwt()` email comparison).
  `handle_new_wholesaler_signup()` (trigger on `auth.users`, AFTER
  INSERT, ON CONFLICT DO NOTHING) starts a 90-day trial row on signup.
  The sync trigger on `public.storefront_profiles` (NOT
  `wholesaler_storefronts` — that table does not exist) keeps
  `company_name` + `public_slug` in the subscription row.
- `components/AdminSaaSDashboard.tsx` — operator-only view ("SaaS
  Admin" in the Platform owner nav). KPIs from REAL rows only (total
  wholesalers, trialing, active, active MRR, pipeline trial MRR) with
  an honest empty state (no fake subscribers). Table with the
  storefront link (`https://wholesalingos.thefeetwashers.com/sell/<slug>`),
  trial countdown, plan status; status changes write via a verified
  update.
- `components/SubscriptionBanner.tsx` — top of the dashboard: trial →
  days left + "Activate Plan"; active → "Pro Active ($150/mo)" +
  "Manage Billing". It hides itself when the table does not exist yet.
  No `alert()` — errors show in the banner.
- `supabase/functions/stripe-billing/index.ts` — file only, NOT
  deployed. Real imports (deno std server, supabase-js@2, Stripe from
  `https://esm.sh/stripe@11.2.0?target=deno` — the import Supabase's own
  knowledge base recommends for Deno Edge Functions). **No keys in the
  file.** When `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID_150_MONTHLY` /
  `STRIPE_WEBHOOK_SECRET` is unset, every route returns
  `{success:false, mode:'not_configured'}` and does NOTHING. Authenticated
  routes (`create_checkout`, `customer_portal`) verify the caller JWT
  and act on that caller's own row only; `create_checkout` carries the
  REMAINING trial days from the subscription row (0 when expired) and
  success/cancel URLs to the site root (`https://wholesalingos.thefeetwashers.com/`
  — there is NO `/dashboard` route). The webhook route verifies the
  Stripe signature and maps subscription statuses onto `plan_status`,
  linked to the wholesaler by `client_reference_id` / subscription
  metadata so it never creates a user-less row.

**Owner steps (NOT DONE — do not do them until the founder decides the
billing model):**

1. Decide: each wholesaler's own Stripe account, or the $150/mo
   platform subscription each wholesaler pays? (Open question — the
   founder wrote "billing (Stripe?)". This function implements the
   PLATFORM model; if the founder decides per-wholesaler Stripe
   accounts instead, it gets replaced, not quietly rewired.)
2. Create the $150/mo product + price in Stripe.
3. `supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_PRICE_ID_150_MONTHLY=price_... STRIPE_WEBHOOK_SECRET=whsec_... STRIPE_PUBLISHABLE_KEY=pk_...`
4. `supabase functions deploy stripe-billing --no-verify-jwt` (webhooks
   arrive without a Supabase JWT; the webhook route verifies the Stripe
   signature instead).
5. Register the webhook in Stripe:
   `https://<project-ref>.supabase.co/functions/v1/stripe-billing/webhook`
   (events: `checkout.session.completed`,
   `customer.subscription.created` / `updated` / `deleted`,
   `invoice.payment_failed`).
