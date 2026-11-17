// Slice 135 — per-state parcel-source registry for the Bulk
// FL Parcel Enricher.
//
// FLORIDA is the ONLY verified entry: the Florida Statewide
// Cadastral roll (FDOR Property Tax Oversight), the same official
// service the single-parcel lookup and the corporate-buyer
// research query use, verified live Nov 15, 2026 (Slice 126).
// It covers all 67 Florida counties in one statewide service.
//
// Other states are NOT listed here. No source is invented for a
// state whose real parcel service has not been verified live —
// the registry shape below (state code, source name, endpoint,
// verified date, status) is ready for future entries, but a state
// joins only when its service is verified live. There is no
// day-one nationwide claim: Texas, for example, has NO statewide
// parcel server (county-level only) and is not claimed to have
// one.

import { FL_CADASTRAL_QUERY_URL } from './property-lookup';

export type ParcelSourceStatus = 'verified' | 'unverified';

export interface ParcelSource {
  stateCode: string;
  stateName: string;
  sourceName: string;
  endpoint: string;
  countiesCovered: number | null;
  verifiedDate: string | null;
  status: ParcelSourceStatus;
  note: string;
}

export const PARCEL_SOURCES: ParcelSource[] = [
  {
    stateCode: 'FL',
    stateName: 'Florida',
    sourceName: 'Florida Statewide Cadastral roll — FDOR Property Tax Oversight',
    endpoint: FL_CADASTRAL_QUERY_URL,
    countiesCovered: 67,
    verifiedDate: '2026-11-15',
    status: 'verified',
    note: 'One statewide service covering all 67 Florida counties. The roll is a yearly snapshot published each August; the county appraiser is the live record.',
  },
];

export function parcelSourceForState(stateCode: string): ParcelSource | undefined {
  const code = stateCode.trim().toUpperCase();
  return PARCEL_SOURCES.find((s) => s.stateCode === code);
}

// Additional states join only as their sources are verified —
// never by guessing a URL or claiming a statewide server a state
// does not have.
export const PARCEL_SOURCES_NOTE =
  'Florida is the only verified parcel source. Additional states join only as their sources are verified live.';
