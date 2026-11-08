import type { MetadataRoute } from 'next';

// Slice 94 — robots. The public surfaces are meant to be found:
// the homepage, the legal pages, the verification page, and every
// wholesaler's public seller page under /sell/ (a seller page is
// published by its owner on purpose). The signed-in workspace is
// a single-page app behind auth at the same address, so there is
// nothing else to list.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: 'https://wholesalingos.thefeetwashers.com/sitemap.xml',
  };
}
