import React from 'react';
import './globals.css';

// Slice 94 — SEO foundation. Every claim in this metadata is a
// fact the platform's own machinery backs (see /verify). The
// JSON-LD below states only what is true today: the operator,
// the application, its real price and trial. There is NO
// aggregateRating and no review markup — the platform does not
// publish ratings it has not counted.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'THE FEET WASHERS, INC.',
      url: 'https://wholesalingos.thefeetwashers.com/',
      email: 'thefeetwashers@gmail.com',
      telephone: '+1-772-971-6129',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '4848 NW 24th Ct, Suite 428',
        addressLocality: 'Lauderdale Lakes',
        addressRegion: 'FL',
        postalCode: '33313',
        addressCountry: 'US',
      },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'WholesalingOS',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web browser',
      url: 'https://wholesalingos.thefeetwashers.com/',
      description:
        'The wholesaling office for solo wholesalers and companies: leads, buyers, contracts, escrow tracking and counted closings — with sealed private workspaces and no scraped data.',
      offers: {
        '@type': 'Offer',
        price: '150',
        priceCurrency: 'USD',
        description: 'WholesalingOS Pro — $150 per month after a 90-day free trial. The subscription is the only platform fee; the platform takes no cut of assignment fees.',
      },
    },
  ],
};

export const metadata = {
  title: 'WholesalingOS — your whole wholesaling business, one office',
  description: 'Wholesaling pipeline: Find, Qualify, Contract, Market, Show, Close, Track. Private portals for wholesalers, cash buyers, sellers, and title companies. 90 days free, then $150/mo.',
  metadataBase: new URL('https://wholesalingos.thefeetwashers.com'),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'WholesalingOS — your whole wholesaling business, one office',
    description: 'Real records, real math, real closings — for wholesalers, buyers, sellers, and title companies. 90 days free, then $150/mo. No cut of your deals.',
    url: '/',
    siteName: 'WholesalingOS',
    type: 'website',
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'WholesalingOS' }],
  },
  twitter: {
    card: 'summary',
    title: 'WholesalingOS — your whole wholesaling business, one office',
    description: 'Real records, real math, real closings. 90 days free, then $150/mo. No cut of your deals.',
    images: ['/icon-512.png'],
  },
  // Slice 46 — home-screen install support (pairs with app/manifest.ts).
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'WholesalingOS' },
  icons: { apple: '/apple-icon.png' },
};

export const viewport = {
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>
        <header className="ws-topbar">
          <a className="ws-brand" href="#">Wholesaling<span>OS</span></a>
          <span className="ws-topbar-price">90 days free, then $150/mo — no other platform fee</span>
        </header>
        <main className="ws-main">{children}</main>
        <footer className="ws-footer">
          WholesalingOS is operated by THE FEET WASHERS, INC. Contracts in this app carry attorney-review labels.
          This app does not scrape, auto-dial, or auto-send messages.
          <br />
          <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a>
        </footer>
      </body>
    </html>
  );
}
