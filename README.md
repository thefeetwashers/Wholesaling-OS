# WholesalingOS — Production Repo Starter (Phase 1 skeleton)

**Status, Oct 27, 2026: STARTER ONLY — not a deployed app, not submitted
to any store, not a full port of the Muse prototype.** This skeleton sets
up the stack the user chose as their developer's lead plan, so Phase 1
can be built in slices without starting from a blank folder.

## Stack (locked Oct 27, 2026)
- Web app: Next.js (see `package.json`)
- Database + auth: Supabase (Postgres + Row Level Security)
- Billing: Stripe — 90 days free, then $150/mo per wholesaler ONLY.
  No $99 tier, no $200/$220 platform tech fee, no Stripe Connect
  auto-split, no Plaid wiring.
- Mobile wrapper: Capacitor (iOS + Android from the same web code)
- Store pipeline: GitHub Actions (main) running Fastlane lanes.
  Appflow Free is BACKUP ONLY for first submission builds, do NOT
  cancel it, and do NOT rely on it past Dec 31, 2027.
  Capawesome Cloud is the fallback only if a managed dashboard is
  later requested.

## What is in this skeleton
- `package.json` — Next.js + Supabase JS + Capacitor CLI. No app
  features are implemented here yet.
- `app/` — Slice 1, built Oct 27, 2026: layout + home page with
  pipeline stages, sync-status checklist, Today Center checklist,
  and the Deal Analyzer (MAO math verified against the Oct 24
  prototype probe). It is NOT the full 15-tab WholesalingOS app.
  The full pipeline (Find -> Qualify -> Contract -> Market -> Show
  -> Close -> Track), fee engine, signature pipeline, walkthrough
  verification, probate guardrail, Today Center sync, and P&L must
  be ported in slices from the verified Muse prototype
  (`wholesalingos` artifact, verified Oct 24, 2026) and from
  `../production/` — not invented here.
- `lib/` — `supabase.ts` (env-only client, setup flag) and `mao.ts`
  (pure MAO / total / JV / P&L math, no seeded deals).
- `components/DealAnalyzer.tsx` — $10k / $20k / Custom fee toggle,
  MAO, Total Marketplace Cost, over-MAO warning.
- Slice 2 (Oct 27, 2026, local only, GitHub push still blocked by the
  403 app-installation issue): `components/AuthPanel.tsx` (Supabase
  email/password + Google OAuth; owner account thefeetwashers@gmail.com),
  `components/Leads.tsx` + `lib/leads.ts` (Lead CRM matching
  production/schema.sql leads columns exactly, status filter, CSV export,
  Supabase sync when configured + signed in, otherwise local session only),
  `components/TodayCenter.tsx` (overdue + due-today follow-ups from your
  own leads only; viewings/EMD/contracts marked Slice 3, not faked).
  NOT run locally (dependencies not installed, Supabase not configured),
  NOT pushed to GitHub yet.
- Slice 3 (Oct 27, 2026, local only, not yet pushed): `lib/contracts.ts`
  + `components/Contracts.tsx` (A-B price-only seller view, JV before
  marketing, B-C locked until A-B Signed with full breakdown + EMD,
  title package via email handoff, attorney-review labels, mailto +
  manual status only, no real e-sign), `components/Viewings.tsx`
  (buyer + seller manual confirmation; both Yes = cleared, otherwise
  HOLD; seller message never reveals buyer or fee),
  `components/Escrow.tsx` (6 manual milestones, EMD countdown from a
  user-set deadline, payout price + fee − referral = net).
  NOT run locally, NOT pushed to GitHub yet.
- Slice 4 (Oct 27, 2026, local only, not yet pushed): `components/Buyers.tsx`
  (own buyer list only, demand count from your buyers only, not live orders),
  `components/Titles.tsx` (7 verified seeds matching schema.sql; user additions
  labeled unverified), `components/Counties.tsx` (St. Lucie FL FIPS 12111 only,
  5 verified URLs; other counties user-added, no guessed URLs; import yields
  owner name + mailing address only), `components/WatchlistProbate.tsx`
  (manual re-check resurrection, probate do-not-contact guardrail, no obituary
  scraping, no auto-contacting heirs), `components/BusinessPL.tsx`
  (own deals only: fee − referral − expenses; $10,000 − $500 − $300 = $9,200).
  NOT run locally, NOT pushed to GitHub yet.
- `capacitor.config.ts` — placeholder app id / name. REPLACE the app
  id with the real bundle id / application id before any store build.
- `fastlane/` — `Fastfile` lanes: `beta` and `appstore` (iOS),
  `beta` and `internal` (Android). All secrets come from GitHub
  Secrets / environment variables. No secret is in this repo.
- `.github/workflows/` — `ios.yml` (macOS runner, Fastlane) and
  `android.yml` (Ubuntu runner, Fastlane). These workflows have NOT
  been run in CI yet — there is no GitHub repo connected from this
  chat, and no Apple/Google signing secrets have been provided.
- `.env.example` — variable names only, values are placeholders.
- `../production/schema.sql` + `schema-v2-additions.sql` — the
  database to run in Supabase. See the FOLLOW-UP in the store-ready
  brief: migration SQL has NOT yet been extended for the newest
  signature/escrow fields; reconcile canonical names at wiring time,
  do not guess.

## Hard rules (from the store-ready brief — do not break them)
- Owner/Admin sees billing status + anonymized aggregates ONLY.
  Never users' private buyer lists or seller leads.
- No scraping (county, Zillow/MLS, Google, obituary), no free bulk
  skip tracing, no AI voice/SMS dialer, no auto-SMS/email, no
  social fingerprinting, no live title-company APIs, no fund webhooks
  without a signed partner agreement.
- No fake stats, companies, funds, users, or example deals. Only
  counts from the user's own logged records.
- Contracts carry attorney-review labels. Attorney review is required
  before the first paying customer.
- Privacy Policy + Terms required before storing other users' data
  (starters in `../production/privacy-terms.md`).

## Setup order (owner-owned steps — Muse cannot do these alone)
1. Create a GitHub repo and push this folder to it.
2. Create a FRESH Supabase project. SECURITY: a Supabase secret key
   was pasted in chat Oct 19, 2026 and is compromised — rotate it
   and never paste keys into chat or files again. Run
   `../production/schema.sql`, then `schema-v2-additions.sql`, in
   that project's SQL editor.
3. Create a Stripe account under THE FEET WASHERS, INC. (the
   for-profit, NOT the nonprofit) with a $150/mo plan and a 90-day
   trial (`trial_period_days: 90`).
4. Fill `.env` from `.env.example` (locally only, never committed).
5. `npm install`, then `npm run dev` to check the shell page.
6. Port the prototype in slices, slice by slice, verifying each
   one — do not paste the whole prototype in at once and call it done.
7. Phase 2 only: Apple Developer Program + Google Play Console
   accounts, Fastlane signing secrets in GitHub Secrets
   (App Store Connect API key, provisioning, Android keystore +
   Play service-account JSON), then run the workflows and submit.

## What has NOT happened yet
- No GitHub repo created, no Vercel deploy, no Supabase project
  provisioned, no Stripe account created, no Apple/Google developer
  accounts enrolled, no store submission, no Apple approval.
  Anyone claiming otherwise is wrong.


## Slice 5 — Supabase sync for buyers, deals, directories (Oct 27, 2026)
- lib/buyers.ts + lib/deals.ts + lib/directories.ts: RLS-scoped load/save matching schema.sql / schema-v2-additions.sql exactly.
- Buyers: load/save to public.buyers when signed in, else local-only labeled.
- Contracts: "Save deal to Supabase" writes a public.deals row (contract_type purchase/assignment, price/ARV/repairs/fee/EMD, signature statuses in documents JSON); saved deals list loads on sign-in.
- Titles: reads public.title_companies from Supabase when signed in, else built-in seeds.
- Counties: reads public.county_portal_links St. Lucie seed from Supabase when signed in, else built-in links.
- Viewings and Escrow remain local-only in Slice 5, labeled as such; deal-linked viewing_slots and escrow_files/milestones saving is Slice 6.
- Still NOT synced: WatchlistProbate lead_events, call_logs, BusinessPL actuals, marketplace_listings lifecycle, privacy_blocklist enforcement (service-role only, no server code yet).


## Slice 6 — Deal-linked viewings and escrow (Oct 27, 2026)
- lib/escrow.ts: marketplace_listings -> escrow_files -> escrow_milestones, matching schema-v2-additions.sql.
- Viewings: pick a saved deal, then "Save viewing to selected deal" writes viewing_slots + confirmed_viewing on that deals row (both-Yes = cleared, else HOLD, same rule as before).
- Escrow: pick a saved deal, then "Save escrow file to Supabase" creates a marketplace listing (total = price + fee), then an escrow file, then append-only milestone rows for the steps marked done. EMD amount on the file comes from the selected deal's emd_amount (0 if the deal has none) — never invented in the escrow form.
- privacy_blocklist is still NOT touched from the app (service-role only, no server code yet).


## Slice 7 — Stripe code + trial access + blocklist server route (Oct 27, 2026)
- lib/access.ts: reads the user's profiles row and mirrors has_access() (active, or trialing with trial_ends_at in the future).
- components/SubscribeButton.tsx: CORRECTED version. No supabaseClient import, no generic stripe.com URLs, no fake portal link. Checkout = owner-pasted NEXT_PUBLIC_STRIPE_PAYMENT_LINK + client_reference_id. Manage = honest "portal session not wired yet" (Stripe Portal needs a server-generated session). Payment link must be the FOR-PROFIT link, NOT the NC GOD INC link verified Oct 27, 2026.
- app/api/stripe/webhook/route.ts: SERVER ONLY. Verifies Stripe signature, updates profiles subscription_status + stripe_customer_id and mirrors subscriptions. Requires STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY in hosting env only. Webhook does NOT work until the owner creates the Stripe account (THE FEET WASHERS, INC.), product, Payment Link, and webhook endpoint in Stripe.
- app/api/check-blocklist/route.ts: SERVER ONLY. Takes SHA-256 hashes, checks privacy_blocklist via service role, returns blocked true/false only. Outreach UI calling it before sending is still future work — do not claim outreach is blocked in-app yet.
- Google owner steps (done by owner Oct 27, 2026, pending sign-in test): OAuth client created + enabled, test-users restricted, redirect URI https://nabztcwabkqhxyxcxarx.supabase.co/auth/v1/callback, Client ID/secret pasted by owner into Supabase Auth > Providers > Google. Sign-in test with a test user is still the verification step.


## Slice 8 — Google OAuth redirect fix (Oct 27, 2026)
- AuthPanel: signInWithOAuth now passes redirectTo: window.location.origin, so a deployed app redirects to its own URL instead of Supabase's fallback localhost:3000 Site URL.
- AuthPanel: OAuth callback errors in the URL (?error= / ?error_description=) are now shown in the panel, instead of a blank sign-in screen.
- This does NOT fix a mismatched Client ID/Secret in Supabase's Google provider — the Oct 27, 2026 test failed at "Unable to exchange external code" after Google accepted, which still needs the owner to re-check/re-paste the provider credentials in Supabase.


## Slice 9 — Full Portals foundation (Oct 29, 2026)
- Owner decision Oct 29, 2026: FULL PORTALS (supersedes the Oct 19 seller/title no-portal verdicts). Every party registers with a role: wholesaler / buyer / seller / title (profiles.role, schema v3 + v3.1 read policies, run in Supabase Oct 29, 2026).
- Registration: AuthPanel role picker ("I am a…") stashed at Create account and applied to the user's own profile on first sign-in; Google sign-ups default to wholesaler; any signed-in user can switch role in Your Portal (roles are self-selected at launch, honestly labeled).
- Your Portal (role-routed home): Wholesaler Dashboard strip (real counts: leads by stage, follow-ups due, deals, assignment fees in pipeline, active listings, new offers — all from the user's own rows); Buyer Portal (buy-box builder saved to buy_boxes, deal feed of active public listings with a price + address-text match badge); Seller Portal (deals linked via deals.seller_user); Title Portal (companies linked via title_companies.portal_user + their escrow files).
- Offers table exists (schema v3); the make-an-offer UI and wholesaler offers inbox actions are Slice 10. In-portal signing is Slice 11.


## Slice 10 — Offers, public deals, buyer demand (Oct 29, 2026)
- Buyers make offers from the deal feed (offers table, schema v3); "My offers" tracks status and counters, with withdraw.
- Wholesaler offers inbox: Accept writes the accepted amount into the deal's documents (bc_status 'offer_accepted') so Contracts shows it; Counter (with amount) and Decline set offer status. No auto-send anywhere.
- Public deals page on the home page: visible signed-out, mandatory assignment-of-equitable-interest disclosure, shareable /?deal=<id> links with a copy button; reads only listings marked public + active (schema v3.2 adds narrowly scoped anon SELECT policies for those listings and the deals behind them — run in Supabase Oct 29, 2026).
- Buyer Demand in the wholesaler dashboard: aggregates of active buy boxes (most-wanted places, criteria list) — buyer identities are never displayed.


## Slice 11 — Seller + Title portals, in-portal signing (Oct 29, 2026)
- Claim-by-ID linking (schema v3.3): a seller claims an unlinked deal by its ID, a title user claims an unlinked company by its ID; RLS allows claiming only rows still unlinked, and updates only to rows linked to you (buyers: deals whose documents.buyer_user is you, stamped by the Slice 10 accept flow).
- In-portal signing with a typed name + timestamp audit trail in documents.signatures: sellers sign the A-B agreement (seller view shows the purchase price ONLY, never the fee); buyers sign the B-C assignment ONLY after A-B reads 'Signed' (same gate as lib/contracts.ts). Statuses use the contracts vocabulary ('Signed').
- Title portal: escrow files with EMD requirement + target closing date and a per-file milestone timeline (v3.3 lets title users read milestones on their own company's files).
- Honest limits: contract wording is still pending attorney review (labeled in the signing UI — not for live transactions yet). No-login signing links are NOT built: they need the Supabase service-role key in the hosting environment (owner step, same bucket as the Stripe webhook secrets); without it there is no safe server-side token read, so nothing is faked.
