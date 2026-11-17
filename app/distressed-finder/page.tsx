import DistressedFinder from '../../components/DistressedFinder';

// Slice 135 — Distressed Finder route. The page itself is a thin
// wrapper; all feed reading, saving, and export lives in
// components/DistressedFinder.tsx over the registry in
// lib/distressed-feeds.ts.

export const metadata = {
  title: 'Distressed Finder — open code violations | WholesalingOS',
  description:
    'Open code-violation cases from 10 cities’ public open-data feeds — Orlando, Miami-Dade, Dallas, Chicago, Austin, New York City, Los Angeles, Nashville, New Orleans, and Kansas City. Read live, saved one row at a time.',
};

export default function DistressedFinderPage() {
  return <DistressedFinder />;
}
