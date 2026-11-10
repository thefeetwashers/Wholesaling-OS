// Slice 117 — Platform Health: the recorded cliffs.
//
// The Admin console's card of dated cliffs and standing limits.
// Every entry is a fact RECORDED BY HAND (each carries the date it
// was recorded), because most of these live in other companies'
// dashboards — AWS, Vercel, Google, Ionic — that this app has no
// truthful live line into. The card therefore computes only
// countdowns from the recorded dates; it never claims a live
// status. When a fact changes, the entry is updated in this file
// in the same commit that learns of the change — a stale entry
// here is a bug of record, and the asOf date on every line says
// exactly how fresh the record claims to be.

export interface DatedCliff {
  label: string;
  date: string; // yyyy-mm-dd
  approx?: boolean;
  detail: string;
  asOf: string; // the date this fact was recorded
}

export interface StandingItem {
  label: string;
  detail: string;
  asOf: string;
}

export const DATED_CLIFFS: DatedCliff[] = [
  {
    label: 'GCP project-shutdown answer',
    date: '2026-11-26',
    detail:
      'The owner’s answer on the Google Cloud project shutdown notice is outstanding; the restore deadline on record is Nov 26, 2026.',
    asOf: '2026-11-10',
  },
  {
    label: 'AWS root MFA enrollment',
    date: '2026-11-22',
    approx: true,
    detail:
      'AWS required root MFA within 14 days of the shared account’s opening (Nov 8, 2026). Owner-only step; recorded as outstanding.',
    asOf: '2026-11-10',
  },
  {
    label: 'AWS free plan ends — account-closure risk',
    date: '2027-05-08',
    approx: true,
    detail:
      'The shared AWS account (opened Nov 8, 2026) sits on the free plan, which closes the account about six months in if it is not upgraded. SES sending for this platform, GovWin, and the staffing platform all ride on this one account.',
    asOf: '2026-11-10',
  },
  {
    label: 'Ionic / Appflow access ends',
    date: '2027-12-31',
    detail:
      'Recorded end of Ionic access. Mobile builds are manual-dispatch only, and still need their Phase 2 prerequisites (a real bundle ID, the native projects, signing) regardless of this date.',
    asOf: '2026-11-10',
  },
];

export const STANDING_ITEMS: StandingItem[] = [
  {
    label: 'Vercel Hobby deployment cap',
    detail:
      '100 deployments per day. Hit on Nov 8, 2026 and repeatedly on Nov 10, 2026: pushes still land, but going live can wait on the rolling window (a manual Create Deployment plus a ~20-minute retry is the working workaround). Vercel Pro removes the cap; that upgrade is an owner decision.',
    asOf: '2026-11-10',
  },
  {
    label: 'SES production access — under review',
    detail:
      'Filed with AWS on Nov 8, 2026; no decision on record yet. Until it is approved, the account sends from the SES sandbox: verified recipients only, 200 messages a day.',
    asOf: '2026-11-10',
  },
  {
    label: 'Compromised Supabase secret — rotation outstanding',
    detail:
      'A secret key for a different Supabase project (ref tjdgrbxvskvfsuufhdib) was pasted in chat on Oct 19, 2026 and must be rotated — read-only identification first, then the owner rotates it in that project’s dashboard. This app’s own project is not affected.',
    asOf: '2026-11-10',
  },
];

export function daysUntil(dateISO: string, todayISO: string): number {
  return Math.round(
    (Date.parse(`${dateISO}T00:00:00Z`) - Date.parse(`${todayISO}T00:00:00Z`)) / 86400000,
  );
}
