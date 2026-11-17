// Slice 135 — Public API docs (/api-docs).
//
// Documents the REAL read-only PostgREST endpoint for published
// deals. Read access only: the anon key reads rows where
// published=true, and nothing else. No write access exists for
// anonymous callers, and the legacy `deals` table — which holds
// assignment fees and seller identity — is NEVER exposed: no
// endpoint, no grant, no mention of it as queryable anywhere.
//
// No real key value appears on this page. The anon key is public
// by design for this read-only endpoint, but this page shows only
// the placeholder YOUR_ANON_KEY — copy your own anon key from
// your Supabase project settings. Never paste a service_role key
// into a client, a snippet, or this page.

import Link from 'next/link';

const codeBlock: React.CSSProperties = {
  background: '#fff',
  color: '#0f172a',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: 16,
  overflowX: 'auto',
  fontSize: 13,
  lineHeight: 1.6,
  margin: '12px 0',
  whiteSpace: 'pre',
};
const panel: React.CSSProperties = { background: '#1e293b', borderRadius: 12, padding: 16, marginTop: 16 };
const whiteCard: React.CSSProperties = {
  background: '#fff',
  color: '#0f172a',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: 16,
  marginTop: 12,
};

const COLUMNS: { name: string; type: string; notes: string }[] = [
  { name: 'city', type: 'text', notes: 'City the wholesaler entered. May be empty.' },
  { name: 'state', type: 'text', notes: 'Two-letter state, e.g. FL.' },
  { name: 'zip', type: 'text', notes: 'ZIP area only — published deals never carry a street address.' },
  { name: 'county', type: 'text', notes: 'County the wholesaler entered.' },
  { name: 'property_type', type: 'text', notes: 'e.g. Single Family, Duplex, Land.' },
  { name: 'beds', type: 'number', notes: 'Bedrooms, when provided.' },
  { name: 'baths', type: 'number', notes: 'Bathrooms, when provided.' },
  { name: 'sqft', type: 'number', notes: 'Living area in square feet, when provided.' },
  { name: 'year_built', type: 'number', notes: 'Year built, when provided.' },
  { name: 'lot_size', type: 'text', notes: 'Lot size as entered by the wholesaler.' },
  { name: 'condition', type: 'text', notes: 'One of: Turnkey, Light rehab, Moderate rehab, Heavy rehab, Gut rehab.' },
  { name: 'occupancy', type: 'text', notes: 'Occupancy as entered, when provided.' },
  { name: 'strategy', type: 'text', notes: 'Wholesaler’s stated strategy, when provided.' },
  { name: 'asking_price', type: 'number', notes: 'Asking price in dollars, when provided. Wholesaler-entered — verify it.' },
  { name: 'arv_low', type: 'number', notes: 'Low end of the wholesaler’s estimated after-repair value, when provided.' },
  { name: 'arv_high', type: 'number', notes: 'High end of the wholesaler’s estimated after-repair value, when provided.' },
  { name: 'repair_estimate', type: 'number', notes: 'Wholesaler’s repair estimate in dollars, when provided.' },
  { name: 'close_by', type: 'text', notes: 'Target close date as entered, when provided.' },
  { name: 'highlights', type: 'text', notes: 'Wholesaler’s highlights, when provided.' },
  { name: 'notes', type: 'text', notes: 'Wholesaler’s notes, when provided.' },
  { name: 'comps', type: 'json', notes: 'Up to 4 wholesaler-entered comps (address, sold price, beds, baths, sq ft, sold date).' },
  { name: 'status', type: 'text', notes: 'Active, Under Contract, or Sold. Missing reads as Active.' },
];

const JS_SNIPPET = `// Read published Florida deals asking $500,000 or less.
// Replace YOUR_ANON_KEY with your project's anon key from
// Supabase → Project Settings → API. Never use a service_role key here.
const res = await fetch(
  'https://nabztcwabkqhxyxcxarx.supabase.co/rest/v1/published_deals' +
    '?select=city,state,zip,county,property_type,beds,baths,sqft,' +
    'condition,strategy,asking_price,arv_low,arv_high,repair_estimate' +
    '&state=eq.FL' +
    '&asking_price=lte.500000' +
    '&published=eq.true' +
    '&order=created_at.desc' +
    '&limit=25',
  {
    headers: {
      apikey: 'YOUR_ANON_KEY',
      Authorization: 'Bearer YOUR_ANON_KEY',
    },
  }
);
const deals = await res.json();`;

const CURL_SNIPPET = `curl 'https://nabztcwabkqhxyxcxarx.supabase.co/rest/v1/published_deals?select=city,state,zip,asking_price,arv_low,arv_high&state=eq.FL&asking_price=lte.500000&published=eq.true&order=created_at.desc&limit=25' \\
  -H 'apikey: YOUR_ANON_KEY' \\
  -H 'Authorization: Bearer YOUR_ANON_KEY'`;

const RESPONSE_SHAPE = `[
  {
    "id": "string (uuid)",
    "user_id": "string (uuid, the publishing wholesaler)",
    "city": "string | null",
    "state": "string | null",
    "zip": "string | null",
    "county": "string | null",
    "property_type": "string | null",
    "beds": "number | null",
    "baths": "number | null",
    "sqft": "number | null",
    "year_built": "number | null",
    "lot_size": "string | null",
    "condition": "string | null",
    "occupancy": "string | null",
    "strategy": "string | null",
    "asking_price": "number | null",
    "arv_low": "number | null",
    "arv_high": "number | null",
    "repair_estimate": "number | null",
    "close_by": "string | null",
    "highlights": "string | null",
    "notes": "string | null",
    "comps": "array of up to 4 comp objects, or null",
    "status": "string (Active | Under Contract | Sold)",
    "published": "true",
    "created_at": "string (timestamp)",
    "updated_at": "string (timestamp)"
  }
]
// Field types only — no row values are shown here, so no price,
// address, or deal is invented. A field reads null when the
// wholesaler did not provide it.`;

export default function ApiDocsPage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/">← WholesalingOS home</Link> · <Link href="/deals">Off-market deals</Link> ·{' '}
        <Link href="/distressed-finder">Distressed Finder</Link>
      </p>
      <h1 style={{ fontSize: 28, margin: '8px 0 4px' }}>API docs — published deals</h1>
      <p style={{ fontSize: 14, color: '#cbd5e1', marginTop: 0 }}>
        Read-only public access to the deals wholesalers have chosen to publish. One endpoint,
        one table, no writes. If a row is not published, it is not here — the anon key cannot
        see it, and this page documents no way around that.
      </p>

      <section style={panel}>
        <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Endpoint</h2>
        <p style={{ fontSize: 14, margin: '0 0 8px' }}>
          The live PostgREST endpoint for the <code>published_deals</code> table:
        </p>
        <pre style={codeBlock}>https://nabztcwabkqhxyxcxarx.supabase.co/rest/v1/published_deals</pre>
        <h3 style={{ fontSize: 15, margin: '14px 0 6px' }}>Authentication</h3>
        <p style={{ fontSize: 14, margin: 0 }}>
          Send your project&apos;s <strong>anon key</strong> as both the <code>apikey</code> header
          and the <code>Authorization: Bearer</code> token. The anon key is public by design for
          this read-only endpoint — but this page shows only the placeholder{' '}
          <code>YOUR_ANON_KEY</code>. Copy your own anon key from Supabase → Project Settings →
          API. <strong>Never use a service_role key in a browser, a snippet, or a client
          app</strong> — it bypasses row-level security.
        </p>
      </section>

      <section style={panel}>
        <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Working example — Florida deals up to $500,000</h2>
        <pre style={codeBlock}>{JS_SNIPPET}</pre>
        <pre style={codeBlock}>{CURL_SNIPPET}</pre>
        <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '8px 0 0' }}>
          <code>state=eq.FL</code> keeps only Florida rows;{' '}
          <code>asking_price=lte.500000</code> keeps only rows asking $500,000 or less;{' '}
          <code>published=eq.true</code> is stated explicitly, though anon SELECT is live only
          where <code>published=true</code> in any case — unpublished rows never come back.
          Standard PostgREST operators apply: <code>eq</code>, <code>neq</code>,{' '}
          <code>gte</code>, <code>lte</code>, <code>ilike</code> (e.g.{' '}
          <code>city=ilike.%miami%</code>), <code>order</code>, <code>limit</code>, and{' '}
          <code>offset</code>.
        </p>
      </section>

      <section style={panel}>
        <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Columns</h2>
        <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '0 0 8px' }}>
          These are the real column names. Ask for them in <code>select=</code>, or omit{' '}
          <code>select</code> to get the whole row. Every money figure is wholesaler-entered —
          confirm the property&apos;s condition and supporting estimates with the submitter before
          making a decision.
        </p>
        <div style={whiteCard}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: 8 }}>Column</th>
                <th style={{ padding: 8 }}>Type</th>
                <th style={{ padding: 8 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((c) => (
                <tr key={c.name} style={{ borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                  <td style={{ padding: 8 }}><code>{c.name}</code></td>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{c.type}</td>
                  <td style={{ padding: 8 }}>{c.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 13.5, color: '#cbd5e1', margin: '10px 0 0' }}>
          Rows also carry <code>id</code>, <code>user_id</code> (the publishing wholesaler),{' '}
          <code>published</code> (always <code>true</code> on this endpoint),{' '}
          <code>created_at</code>, and <code>updated_at</code>. Published deals carry no street
          address and no seller contact — locations show the ZIP area only.
        </p>
      </section>

      <section style={panel}>
        <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Response shape</h2>
        <pre style={codeBlock}>{RESPONSE_SHAPE}</pre>
      </section>

      <section style={panel}>
        <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>What is NOT exposed</h2>
        <ul style={{ fontSize: 14, margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>
            <strong>The legacy <code>deals</code> table is NEVER exposed.</strong> It holds
            assignment fees and seller identity, and it has no public endpoint, no anon grant,
            and no read path in this API. Do not query it — there is nothing to query.
          </li>
          <li>
            <strong>No write access.</strong> POST, PATCH, and DELETE as an anonymous caller are
            not granted. Deals are published only inside the app, by the signed-in wholesaler who
            owns the lead, after they confirm. Nothing on this page writes anything.
          </li>
          <li>
            <strong>No seller contact, no street address, no assignment fee.</strong> None of
            those exist on <code>published_deals</code>, so no query can return them.
          </li>
          <li>
            <strong>No keys on this page.</strong> The only key named here is the placeholder{' '}
            <code>YOUR_ANON_KEY</code>. No real key value is printed, and no key is embedded in
            the page.
          </li>
        </ul>
      </section>

      <p style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 24 }}>
        WholesalingOS is a connection platform, not a broker, lender, title company, or legal
        advisor. Published deals are wholesaler-provided listings — asking prices, ARV, and repair
        estimates come from the wholesaler who published the deal.
      </p>
    </main>
  );
}
