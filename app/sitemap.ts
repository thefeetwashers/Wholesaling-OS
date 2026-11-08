import type { MetadataRoute } from 'next';

// Slice 94 — the sitemap lists exactly the platform's static
// public pages. Seller pages (/sell/<slug>) are dynamic and
// owner-published; they are discoverable through the links their
// owners share and are not enumerated here, because the sitemap
// is generated at build time and a slug list would go stale.
const BASE = 'https://wholesalingos.thefeetwashers.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, lastModified: new Date('2026-11-08'), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/verify`, lastModified: new Date('2026-11-08'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/privacy`, lastModified: new Date('2026-10-31'), changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE}/terms`, lastModified: new Date('2026-10-31'), changeFrequency: 'yearly', priority: 0.4 },
  ];
}
