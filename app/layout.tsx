import React from 'react';
import './globals.css';

export const metadata = {
  title: 'WholesalingOS — your whole wholesaling business, one office',
  description: 'Wholesaling pipeline: Find, Qualify, Contract, Market, Show, Close, Track. Private portals for wholesalers, cash buyers, sellers, and title companies. 90 days free, then $150/mo.',
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
