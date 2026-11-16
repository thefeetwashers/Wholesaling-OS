# WholesalingOS — Developer Deployment README

> The platform is **WholesalingOS** at **https://wholesalingos.thefeetwashers.com**
> (and **https://wholesalingos.vercel.app**). `thefeetwashers.com` is the
> HOME-CARE site — it is never the platform URL. Every URL in this file uses
> the `wholesalingos` domain.

This file is the deployment guide for a developer picking up the repo. It
lists the system as it actually is — file names, migration names, routes, and
environment variables were all verified against the tree on Nov 16, 2026.
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

### Other

- `lib/ledger.ts` — the slice ledger (code-only verified vs live proof
  deferred, per slice). Read it before touching a slice.
- `lib/scripts-data.ts` — the approved outreach wording (probate-call,
  probate-letter, foreclosure-call, and the rest). Modals reuse these
  templates; never invent new promises in outreach copy.

## 3. Migrations — order and the commit-pinned URL rule

Already applied (Nov 15, 2026 — do not re-run unless the database was reset):

| File | Slice |
| --- | --- |
| `20261115090000_capital_lending_lender_role.sql` | Capital & Lending |
| `20261115091500_capital_lending_fee_exact.sql` | Slice 120 |
| `20261115110000_winwin_ecosystem.sql` | Slice 122 |
| `20261115120000_slice123_leads_columns.sql` | Slice 123 |
| `20261115130000_slice124_storefront.sql` | Slice 124 |
| `20261115140000_slice125_seller_firsts.sql` | Slice 125 |

New in this push (apply in order, after the deploy):

| File | Contents |
| --- | --- |
| `20261115150000_probate_leads.sql` | `probate_leads` + `leads.probate_case_number` + 18-param seller RPCs + `probate_lead_activity` |
| `20261115160000_cash_buyers.sql` | `cash_buyers` |
| `20261115170000_saas_subscriptions.sql` | `saas_subscriptions` + signup trigger + storefront sync trigger |
| `20261115180000_leads_owner_contact.sql` | `owner_phone` / `owner_email` on `public.leads` |

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

- The per-wholesaler settings store (table + key encryption) is a
  **follow-up slice**: it does not exist yet, no provider is chosen yet
  (the founder is researching options and costs first), and nothing is to
  be set up yet. Until a provider is chosen and the settings store exists,
  the function returns `{ success: false, mode: 'not_configured' }` and
  writes **nothing**. The UI falls back to manual entry.
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
  `getGoogleKeys(userId)` (the future `wholesaler_provider_settings`
  store — it does not exist yet, so the lookup returns null). It NEVER
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

## 8. Go-live checklist (this push: Slices 126 + 127 + 128 + 129)

1. Push via the GitHub approval card → Vercel auto-deploys in 2–3 minutes.
   The first live check after a push usually catches the old build —
   re-check before concluding failure. Confirm the build tag reads
   **Slice 129** on both `wholesalingos.thefeetwashers.com` and
   `wholesalingos.vercel.app`.
2. Apply migrations `20261115150000`, `20261115160000`, `20261115170000`,
   and `20261115180000` in Supabase via commit-pinned raw URLs (§3).
   Confirm `probate_leads`, `probate_lead_activity`, `cash_buyers`,
   `saas_subscriptions`, `leads.probate_case_number`, and
   `leads.owner_phone` / `leads.owner_email` exist.
3. Run the pre-flight script (after `.env.local` holds the real Supabase
   URL + anon key): `node --env-file=.env.local
   scripts/verify-wholesalingos.mjs`. It checks the real files, the real
   tables (a 401/403 means "reachable (anon blocked)" — it does NOT prove
   RLS), and the 3 Edge Functions via OPTIONS (they are expected to
   report missing until the owner deploys them).
3. Mode B parcel lookup (Slice 126 proof): parcel `494125000190`, Broward
   (countyCode 6) must return the Lauderdale Lakes parcel with county
   Broward — not Duval, not `[]`.
4. Probate import: upload the docket CSV (or its `.xlsx`) and confirm the
   counts reproduce exactly — **27 cases, 26 OPEN, 1 CLOSED
   (`2026CP001398`), 7 Pro Se, 0 without a decision-maker**, with the 5
   seed cases exact (001433 SCHOEPP, 001412 SMALLEY + HCA FLORIDA ST LUCIE
   HOSPITAL claim, 001408 SCARFONE, 001406 KURLANTZICK, 001397 ZEHNER).
5. Storefront: open `https://wholesalingos.thefeetwashers.com/sell/thefeetwashers`
   in incognito, submit via `?case=2026CP001433`, and confirm the lead in
   the Leads dashboard carries `probate_case_number = 2026CP001433` and
   the probate row shows "Seller submitted".
6. Skip-trace: with no provider connected, invoke the function and confirm it returns
   `not_configured` and writes nothing. Do not deploy it, set any key, or build a
   per-wholesaler settings store until the founder picks providers (§5, BYOK).
7. Contracts: Draft Contract from a probate row and from an inbound lead;
   confirm the prefill carries the seller/property/case (price only from
   `offer_amount` when set, never from MAO) and the form will not print
   until the price/fee is entered.
8. Cash Buyers: add one real buyer, build one blast from real numbers,
   copy it (never auto-sent).
9. Confirm the distress importer accepts the 160-row foreclosure file
   with all rows flagged "address needed".
10. Google Lookup: from a probate row, open the lookup and confirm the
    Google link opens the targeted search and the modal shows the honest
    `not_configured` message (the function is not deployed and no
    provider is connected) — and that saving a manually entered phone
    writes it to the decision-maker without marking Contacted.
11. County presets: switch the preset to Broward, confirm the clerk +
    appraiser links open the right official pages, and import a
    Broward-style header ("Party Name", "Role", "Case #", "Case
    Status") — it must parse. The checkbox lists are unverified; confirm
    them on the clerk site before relying on them.
12. JV Split: open the calculator, confirm all money fields start empty
    and Partner A loads from your own storefront profile (blank with a
    note when no profile is saved), and preview the agreement — it must
    be the existing JV template (0% platform fee, 24-month
    non-circumvention).
13. SaaS Admin (operator only): confirm the dashboard shows the honest
    empty state (no wholesalers yet) and the subscription banner shows
    the trial countdown; do NOT deploy the stripe-billing function or
    set Stripe secrets until the founder decides the billing model (§10).

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
