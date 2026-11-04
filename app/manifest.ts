import type { MetadataRoute } from 'next';

// Slice 46 — installable web app. Wholesalers work from driveways
// and kitchen tables: with this manifest (and the icons in public/),
// the office installs to a phone home screen — full-screen, its own
// icon — without waiting on any app store. The data and sign-in are
// the same live office; this changes only how it opens.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WholesalingOS — your whole wholesaling business, one office',
    short_name: 'WholesalingOS',
    description: 'Wholesaling pipeline: leads, contracts, escrow, buyers — Find to Track.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
