// Slice 129 — Method 1 Google Lookup (zero cost, no keys).
//
// A "Google Lookup" button builds a targeted Google search for a
// person's public phone number and email and opens it in a new tab.
// No API, no scraping, no key — just a link to google.com/search.
// The in-app Edge Function (Method 2, supabase/functions/
// google-skip-trace) is a separate, file-only path; this link works
// whether or not it is ever deployed.

import { formatPersonName } from './probate-import';

// "SCHOEPP, BARBARA SUE" -> "Barbara Sue Schoepp". Reuses the
// shared name helpers — never split().trim() on an array.
export function googleLookupUrl(rawName: string, location: string): string {
  const name = formatPersonName(rawName);
  const loc = (location || '').trim();
  const query = loc
    ? `"${name}" "${loc}" (phone OR cell OR email OR "@")`
    : `"${name}" (phone OR cell OR email OR "@")`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
