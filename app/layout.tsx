import React from 'react';
import './globals.css';

export const metadata = {
  title: 'WholesalingOS — your whole wholesaling business, one office',
  description: 'Wholesaling pipeline: Find, Qualify, Contract, Market, Show, Close, Track. Private portals for wholesalers, cash buyers, sellers, and title companies. 90 days free, then $150/mo.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="ws-topbar">
          <a className="ws-brand" href="#">Wholesaling<span>OS</span></a>
          <nav className="ws-nav">
            <a href="#dashboard">Dashboard</a>
            <a href="#today">Today</a>
            <a href="#leads">Leads</a>
            <a href="#contracts">Contracts</a>
            <a href="#buyers">Buyers</a>
            <a href="#money">Money</a>
          </nav>
          <span className="ws-topbar-price">90 days free, then $150/mo — no other platform fee</span>
        </header>
        <main className="ws-main">{children}</main>
        <footer className="ws-footer">
          WholesalingOS is operated by THE FEET WASHERS, INC. Contracts in this app carry attorney-review labels.
          This app does not scrape, auto-dial, or auto-send messages.
        </footer>
      </body>
    </html>
  );
}
