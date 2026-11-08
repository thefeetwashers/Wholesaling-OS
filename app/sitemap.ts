import type { MetadataRoute } from 'next';
import { LESSONS } from '../lib/lessons';

// Slice 94 — the sitemap lists exactly the platform's static
// public pages. Seller pages (/sell/<slug>) are dynamic and
// owner-published; they are discoverable through the links their
// owners share and are not enumerated here, because the sitemap
// is generated at build time and a slug list would go stale.
// Slice 95 — the School lessons join the list from the same
// data file that renders them, so the sitemap cannot drift
// from the lessons that exist.
const BASE = 'https://wholesalingos.thefeetwashers.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, lastModified: new Date('2026-11-08'), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/verify`, lastModified: new Date('2026-11-08'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/ledger`, lastModified: new Date('2026-11-08'), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/charter`, lastModified: new Date('2026-11-08'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/learn`, lastModified: new Date('2026-11-08'), changeFrequency: 'weekly', priority: 0.8 },
    ...LESSONS.map((l) => ({
      url: `${BASE}/learn/${l.slug}`,
      lastModified: new Date('2026-11-08'),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    { url: `${BASE}/privacy`, lastModified: new Date('2026-10-31'), changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE}/terms`, lastModified: new Date('2026-10-31'), changeFrequency: 'yearly', priority: 0.4 },
  ];
}
