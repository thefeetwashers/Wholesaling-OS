// Slice 129 — pre-flight verification script.
//
// What it checks, honestly:
//   (1) The REAL files this repo actually has (the files Slices
//       126–129 created + the existing key files). It does NOT
//       check for the paste-listed files that do not exist and must
//       never be created (app/dashboard/page.tsx,
//       components/WholesalingOSDashboard.tsx,
//       components/ProbatePriorityLeads.tsx,
//       components/DistressedOffMarketRadar.tsx,
//       components/InboundSellerLeadsTable.tsx,
//       components/StorefrontSettingsForm.tsx,
//       components/WholesalerStorefrontPage.tsx,
//       components/GlobalMasterSearch.tsx,
//       lib/smartCourtCsvParser.ts,
//       lib/supabase/probateLeadsApi.ts).
//   (2) The REAL tables via the Supabase REST API. A 200 means the
//       table is readable with the anon key; a 401/403 means the
//       table is reachable but blocked for anon — that does NOT
//       prove RLS is active, only that anon cannot read it (RLS is
//       proven by the migration files and their policies, not by
//       this ping); a 404 means the table is missing. It does NOT
//       check wholesaler_storefronts, seller_leads, or
//       distressed_leads (they do not exist).
//   (3) The 3 Edge Functions via OPTIONS. They are NOT deployed yet
//       (files only), so this script is EXPECTED to report them
//       missing until the owner deploys them. It must NOT claim
//       they are deployed.
//
// Usage (from the repo root, after .env.local holds the real
// Supabase URL + anon key):
//   node --env-file=.env.local scripts/verify-wholesalingos.mjs
// Exits non-zero if .env.local values are missing or any check
// fails; zero only when all pass. No fake data, no invented URLs.
// The deploy step is: git push → Vercel auto-deploys
// https://wholesalingos.thefeetwashers.com (there is no manual
// deploy command).

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://wholesalingos.thefeetwashers.com';

// --- (1) Real files -------------------------------------------------------
const EXPECTED_FILES = [
  // App routes (the dashboard is the site root — there is NO
  // /dashboard route in this repo).
  'app/page.tsx',
  'app/sell/[slug]/page.tsx',
  'app/track/[token]/page.tsx',
  'app/school/page.tsx',
  // Components — desks, modals, calculators, admin.
  'components/ProbateLeads.tsx',
  'components/ProbateOutreachModal.tsx',
  'components/ProbateDirectMailPrintModal.tsx',
  'components/GoogleSkipTraceModal.tsx',
  'components/WholesaleContractGenerator.tsx',
  'components/JVCoWholesalingCalculator.tsx',
  'components/CashBuyersDealBlast.tsx',
  'components/GlobalSearch.tsx',
  'components/CountyPresetBar.tsx',
  'components/SubscriptionBanner.tsx',
  'components/AdminSaaSDashboard.tsx',
  // Libraries.
  'lib/floridaCountyPresets.ts',
  'lib/probate-import.ts',
  'lib/probate-leads-api.ts',
  'lib/spreadsheet.ts',
  'lib/contracts.ts',
  'lib/storefront.ts',
  'lib/ledger.ts',
  // Docs + Edge Functions + migrations.
  'DEPLOYMENT_README.md',
  'supabase/functions/skip-trace-decision-maker/index.ts',
  'supabase/functions/google-skip-trace/index.ts',
  'supabase/functions/stripe-billing/index.ts',
  'supabase/migrations/20261115150000_probate_leads.sql',
  'supabase/migrations/20261115160000_cash_buyers.sql',
  'supabase/migrations/20261115170000_saas_subscriptions.sql',
  'supabase/migrations/20261115180000_leads_owner_contact.sql',
];

// --- (2) Real tables --------------------------------------------------------
const EXPECTED_TABLES = [
  'probate_leads',
  'probate_lead_activity',
  'leads',
  'storefront_profiles',
  'cash_buyers',
  'saas_subscriptions',
  'funding_requests',
  'lender_boxes',
  'scout_leads',
  'vendor_directory',
  'vendor_bid_requests',
  'jv_listings',
  'jv_interests',
  'mail_credits_ledger',
  'school_progress',
  'seller_advance_requests',
];

// --- (3) Edge Functions (files only, NOT deployed yet) ---------------------
const EXPECTED_FUNCTIONS = [
  'skip-trace-decision-maker',
  'google-skip-trace',
  'stripe-billing',
];

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.log(`  FAIL  ${msg}`);
};
const pass = (msg) => console.log(`  ok    ${msg}`);

console.log('WholesalingOS pre-flight check');
console.log(`Site: ${SITE_URL}`);
console.log(`Repo: ${root}`);

// Env — read from .env.local via node --env-file=.env.local. Missing
// values are a hard failure, never a silent pass.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
if (!supabaseUrl || !anonKey) {
  console.log('');
  console.log('FAIL: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.');
  console.log('  Copy .env.example to .env.local and fill in the real Supabase project values,');
  console.log('  then run: node --env-file=.env.local scripts/verify-wholesalingos.mjs');
  process.exit(1);
}

console.log('');
console.log('[1] Files');
for (const file of EXPECTED_FILES) {
  const full = join(root, file);
  if (existsSync(full)) pass(file);
  else fail(`missing file: ${file}`);
}

// The build tag is the deployment marker: the dashboard must say
// which slice is live.
try {
  const page = readFileSync(join(root, 'app/page.tsx'), 'utf8');
  const tag = page.match(/Slice \d+/g);
  if (tag) pass(`build tag in app/page.tsx: ${tag[tag.length - 1]}`);
  else fail('app/page.tsx has no build tag (expected "Slice N")');
} catch {
  fail('could not read app/page.tsx for the build tag');
}

console.log('');
console.log('[2] Tables (Supabase REST API, anon key)');
for (const table of EXPECTED_TABLES) {
  try {
    const res = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}?select=id&limit=1`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    );
    if (res.status === 200) pass(`${table} — readable (200)`);
    else if (res.status === 401 || res.status === 403) {
      pass(`${table} — reachable (anon blocked — RLS or no anon policy)`);
    } else if (res.status === 404) {
      fail(`${table} — missing (404; run the migration for this table)`);
    } else {
      fail(`${table} — unexpected HTTP ${res.status}`);
    }
  } catch (err) {
    fail(`${table} — request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
console.log('  Note: a 401/403 above proves anon cannot read the table —');
console.log('  it does NOT prove RLS is active. RLS is proven by the');
console.log('  migration files and their policies, not by this ping.');

console.log('');
console.log('[3] Edge Functions (OPTIONS — expected MISSING until the owner deploys them)');
for (const fn of EXPECTED_FUNCTIONS) {
  try {
    const res = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${fn}`,
      { method: 'OPTIONS' },
    );
    if (res.status === 404) {
      console.log(`  not deployed (expected)  ${fn} — file exists, function not deployed yet`);
    } else {
      pass(`${fn} — responded HTTP ${res.status}`);
    }
  } catch (err) {
    console.log(`  not deployed (expected)  ${fn} — ${err instanceof Error ? err.message : String(err)}`);
  }
}
console.log('  Edge Functions are files only until the owner runs');
console.log('  supabase functions deploy <name> (after keys exist).');

console.log('');
if (failures > 0) {
  console.log(`RESULT: ${failures} check(s) failed. Fix them, then re-run.`);
  console.log('Deploy step when everything passes: git push → Vercel auto-deploys ' + SITE_URL);
  process.exit(1);
}
console.log('RESULT: all checks passed.');
console.log('Deploy step: git push → Vercel auto-deploys ' + SITE_URL);
