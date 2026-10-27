import React from 'react';

export const metadata = {
  title: 'WholesalingOS',
  description: 'Wholesaling pipeline: Find, Qualify, Contract, Market, Show, Close, Track. 90 days free, then $150/mo.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#0f172a', color: '#e2e8f0' }}>
        <header style={{ padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between' }}>
          <strong>WholesalingOS</strong>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>90 days free, then $150/mo — no other platform fee</span>
        </header>
        <main style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>{children}</main>
        <footer style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          Contracts in this app carry attorney-review labels. This app does not scrape, auto-dial, or auto-send messages.
        </footer>
      </body>
    </html>
  );
}
