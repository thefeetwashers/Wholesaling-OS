// Slice 129 — Florida county clerk & property appraiser presets.
//
// One preset per county the platform works: the clerk portal to pull
// the docket CSV from, the property appraiser site to look the
// decedent's address up on, the court-type filter and the clerk
// checkboxes to tick before exporting, and the default city/state
// passed into the Google skip-trace modal.
//
// URL VERIFICATION (Nov 16, 2026 — checked by curl + the page
// crawler; a URL ships only if it answered live):
//   St. Lucie clerk   https://stlucieclerk.gov — curl 200.
//   St. Lucie PA      https://paslc.gov — curl returns 403 (bot wall);
//                     the site itself loads in a real browser
//                     (verified Nov 16: the main site loads, only the
//                     search routes block automated browsers).
//   Broward clerk     https://browardclerk.org — curl 200.
//   Broward PA        https://bcpa.net — curl 200.
//   Palm Beach clerk  https://mypalmbeachclerk.com — curl returns 403
//                     (bot wall); the crawler loaded the live clerk
//                     home page Nov 16.
//   Palm Beach PA     https://pbcpao.gov — curl 200. The pasted
//                     pbcgov.org was the COUNTY homepage, not the
//                     appraiser — corrected to pbcpao.gov (PAPA).
//   Miami-Dade clerk  https://miamidadeclerk.gov — curl 200.
//   Miami-Dade PA     https://www.miamidadepa.gov/pa/home.page —
//                     curl 200. The pasted miamidade.gov was the
//                     county homepage, not the PA page — corrected.
//   Martin clerk      https://martinclerk.com — curl 200.
//   Martin PA         https://pa.martin.fl.us — crawler loaded the
//                     live PA home page Nov 13 (curl 000 is a
//                     sandbox egress artifact, not a dead site).
//                     The pasted martin.fl.us was the county
//                     homepage — corrected.
//   Indian River clerk https://indianriverclerk.com/court-records/online-case-view
//                     — curl 200. The pasted indian-river.org was
//                     the county site, not the clerk — corrected to
//                     the clerk's verified Online Case View.
//   Indian River PA   https://ircpa.org — curl 200.
//   Charlotte clerk   https://charlotteclerk.com — curl 200.
//   Charlotte PA      https://ccappraiser.com — curl 200.
//
// CHECKBOX LISTS ARE UNVERIFIED: the probateCaseCheckboxes lists
// below are the paste's labels, NOT confirmed against any clerk
// site. The CountyPresetBar labels them "Clerk filters — confirm on
// the clerk site" and never presents them as exact. Do not invent
// checkbox labels, and do not treat a ticked list here as proof the
// clerk's export used those filters.

export interface FloridaCountyPreset {
  id: string;
  label: string;
  clerkPortalName: string;
  clerkSearchUrl: string;
  propertyAppraiserName: string;
  propertyAppraiserUrl: string;
  courtTypeFilter: string;
  probateCaseCheckboxes: string[];
  defaultCityState: string;
  /** How the URL was verified (curl 200, or crawler-loaded live). */
  verificationNote: string;
}

export const FLORIDA_COUNTY_PRESETS: FloridaCountyPreset[] = [
  {
    id: 'st-lucie',
    label: 'St. Lucie County, FL',
    clerkPortalName: 'St. Lucie County Clerk Court Search',
    clerkSearchUrl: 'https://stlucieclerk.gov',
    propertyAppraiserName: 'St. Lucie Property Appraiser (PASLC)',
    propertyAppraiserUrl: 'https://paslc.gov',
    courtTypeFilter: 'Probate/Guardianship (CP)',
    probateCaseCheckboxes: [
      'FORMAL ADMINISTRATION',
      'SUMMARY ADMINISTRATION',
      'SUMMARY ADM MORE THAN 1,000.00',
      'FAMILY ADMINISTRATION',
      'OTHER PROBATE',
    ],
    defaultCityState: 'Port St. Lucie, FL',
    verificationNote: 'Clerk: curl 200. Appraiser: loads in a real browser (verified Nov 16, 2026); curl returns 403 (bot wall).',
  },
  {
    id: 'broward',
    label: 'Broward County, FL',
    clerkPortalName: 'Broward County Clerk Case Search',
    clerkSearchUrl: 'https://browardclerk.org',
    propertyAppraiserName: 'Broward County Property Appraiser (BCPA)',
    propertyAppraiserUrl: 'https://bcpa.net',
    courtTypeFilter: 'Probate (PR-C)',
    probateCaseCheckboxes: [
      'Formal Administration',
      'Summary Administration',
      'Ancillary Administration',
      'Family Administration',
      'Petition to Admit Foreign Will',
    ],
    defaultCityState: 'Fort Lauderdale, FL',
    verificationNote: 'Clerk + appraiser: curl 200.',
  },
  {
    id: 'palm-beach',
    label: 'Palm Beach County, FL',
    clerkPortalName: 'Palm Beach Clerk eCaseView',
    clerkSearchUrl: 'https://mypalmbeachclerk.com',
    propertyAppraiserName: 'Palm Beach Property Appraiser (PAPA)',
    propertyAppraiserUrl: 'https://pbcpao.gov',
    courtTypeFilter: 'Probate (CP)',
    probateCaseCheckboxes: [
      'Formal Administration',
      'Summary Administration',
      'Ancillary Administration',
      'Other Probate',
    ],
    defaultCityState: 'West Palm Beach, FL',
    verificationNote: 'Clerk: loads in the crawler (verified Nov 16, 2026); curl returns 403 (bot wall). Appraiser: curl 200 (pbcpao.gov — the pasted pbcgov.org was the county homepage, corrected).',
  },
  {
    id: 'miami-dade',
    label: 'Miami-Dade County, FL',
    clerkPortalName: 'Miami-Dade Clerk Civil & Probate Search',
    clerkSearchUrl: 'https://miamidadeclerk.gov',
    propertyAppraiserName: 'Miami-Dade Property Appraiser',
    propertyAppraiserUrl: 'https://www.miamidadepa.gov/pa/home.page',
    courtTypeFilter: 'Probate (CP)',
    probateCaseCheckboxes: [
      'Formal Administration',
      'Summary Administration',
      'Ancillary Administration',
      'Petition for Administration',
    ],
    defaultCityState: 'Miami, FL',
    verificationNote: 'Clerk + appraiser: curl 200 (appraiser corrected from miamidade.gov, the county homepage, to the PA page).',
  },
  {
    id: 'martin',
    label: 'Martin County, FL',
    clerkPortalName: 'Martin County Clerk Court Records',
    clerkSearchUrl: 'https://martinclerk.com',
    propertyAppraiserName: 'Martin County Property Appraiser (MCPA)',
    propertyAppraiserUrl: 'https://pa.martin.fl.us',
    courtTypeFilter: 'Probate (CP)',
    probateCaseCheckboxes: [
      'Formal Administration',
      'Summary Administration',
      'Ancillary Administration',
      'Family Administration',
    ],
    defaultCityState: 'Stuart, FL',
    verificationNote: 'Clerk: curl 200. Appraiser: crawler loaded the live PA home page Nov 13, 2026 (corrected from martin.fl.us, the county homepage).',
  },
  {
    id: 'indian-river',
    label: 'Indian River County, FL',
    clerkPortalName: 'Indian River Clerk Court Search',
    clerkSearchUrl: 'https://indianriverclerk.com/court-records/online-case-view',
    propertyAppraiserName: 'Indian River Property Appraiser (IRCPA)',
    propertyAppraiserUrl: 'https://ircpa.org',
    courtTypeFilter: 'Probate (CP)',
    probateCaseCheckboxes: [
      'Formal Administration',
      'Summary Administration',
      'Ancillary Administration',
      'Other Probate',
    ],
    defaultCityState: 'Vero Beach, FL',
    verificationNote: 'Clerk: curl 200 (Online Case View — corrected from indian-river.org, the county site). Appraiser: curl 200.',
  },
  {
    id: 'charlotte',
    label: 'Charlotte County, FL',
    clerkPortalName: 'Charlotte County Clerk Court Records',
    clerkSearchUrl: 'https://charlotteclerk.com',
    propertyAppraiserName: 'Charlotte County Property Appraiser (CCPA)',
    propertyAppraiserUrl: 'https://ccappraiser.com',
    courtTypeFilter: 'Probate (CP)',
    probateCaseCheckboxes: [
      'Formal Administration',
      'Summary Administration',
      'Ancillary Administration',
      'Summary Administration > $1,000',
    ],
    defaultCityState: 'Port Charlotte, FL',
    verificationNote: 'Clerk + appraiser: curl 200.',
  },
];

export const DEFAULT_FLORIDA_COUNTY_PRESET = FLORIDA_COUNTY_PRESETS[0];

export function presetForCountyLabel(label: string | null | undefined): FloridaCountyPreset | null {
  if (!label) return null;
  const norm = label.trim().toLowerCase();
  return FLORIDA_COUNTY_PRESETS.find((p) => p.label.toLowerCase() === norm) || null;
}

// The appraiser URL for a county label — the preset's VERIFIED
// appraiser page, or null when the county has no preset yet (honest
// empty state, no link shown). paslc.gov is St. Lucie ONLY because
// that is what its preset carries; no other county gets it.
export function appraiserUrlForCounty(county: string | null | undefined): string | null {
  const preset = presetForCountyLabel(county);
  return preset ? preset.propertyAppraiserUrl : null;
}

// The clerk portal URL for a county label, or null when the county
// has no preset yet.
export function clerkUrlForCounty(county: string | null | undefined): string | null {
  const preset = presetForCountyLabel(county);
  return preset ? preset.clerkSearchUrl : null;
}
