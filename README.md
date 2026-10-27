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
