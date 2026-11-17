import type { Metadata } from 'next';
import SchoolBootcamp from '../../components/SchoolBootcamp';

const COURSE_URL = 'https://wholesalingos.thefeetwashers.com/school';

export const metadata: Metadata = {
  title: 'WholesalingOS School — Free 7-Day Deal Launch Bootcamp',
  description:
    'A free 7-day wholesaling bootcamp: buyers first, official county records, real deal math (70% rule, MAO & DSCR), compliant outreach, equitable interest & assignment contracts, double closes & transactional funding, and title, EMD deadlines & closing table payouts.',
  alternates: { canonical: COURSE_URL },
  openGraph: {
    title: 'WholesalingOS School — Free 7-Day Deal Launch Bootcamp',
    description:
      'Seven free days: buyers first, county records, deal math, compliant outreach, contracts, double closes, and the closing table.',
    url: COURSE_URL,
  },
};

// Slice 122 — WholesalingOS School. Publicly readable lessons; the
// bootcamp component handles sign-in progress and the Day 7 quiz
// client-side. The JSON-LD Course schema points at the real school
// URL on WholesalingOS. No ranking or traffic claim is made here.
export default function SchoolPage() {
  const courseJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: 'WholesalingOS School — 7-Day Deal Launch Bootcamp',
    description:
      'A free 7-day wholesaling bootcamp: buyers first, official county records, real deal math (70% rule, MAO & DSCR), compliant outreach, equitable interest & assignment contracts, double closes & transactional funding, and title, EMD deadlines & closing table payouts.',
    provider: {
      '@type': 'Organization',
      name: 'WholesalingOS',
      url: 'https://wholesalingos.thefeetwashers.com',
    },
    url: COURSE_URL,
    isAccessibleForFree: true,
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: 'P7D',
    },
  };
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px 64px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }} />
      <h1 style={{ margin: '0 0 6px', fontSize: 28 }}>WholesalingOS School — Free 7-Day Deal Launch Bootcamp</h1>
      <p style={{ fontSize: 15, color: '#cbd5e1', margin: '0 0 20px' }}>
        Seven days, one deal at a time. Every lesson is drawn from what this platform already teaches — the lists, the scripts, the
        calculators, the escrow desk. Read them free, track your progress when you sign in, and pass the Day 7 check to earn the Verified
        Operator badge on your Wholesaler profile.
      </p>
      <SchoolBootcamp />
    </main>
  );
}
