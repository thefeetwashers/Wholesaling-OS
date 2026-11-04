// Slice 40 — government & auction sales directory. A curated list of
// OFFICIAL sources, every entry opened and confirmed by fetch on
// Nov 3, 2026 before it was listed (the Slice 22 standard). The
// platform pulls NO listings from any of them — no scraping, no
// auto-sync. The wholesaler registers and bids on the official site,
// under that site's rules (deposits, deadlines, buyer premiums).
//
// Deliberately NOT listed, with reasons recorded in the research log:
// - GSA Auctions (gsaauctions.gov): federal surplus PERSONAL property
//   (vehicles, equipment) — not real estate. GSA Real Estate Sales is
//   the real-property channel and IS listed.
// - TreasuryDirect: sells Treasury securities, not seized property.
// - Realauction county subdomains: three were confirmed in a LIVE
//   browser on Nov 3, 2026 and are listed below (stlucie and
//   charlotte .realforeclose.com, broward.realtaxdeed.com). Two are
//   still excluded: palmbeach.realforeclose.com and
//   stlucie.realtaxdeed.com both redirect to the Realauction homepage
//   instead of a county sale page (live check, Nov 3, 2026) — for
//   those, the directory links the CLERK's official page, which links
//   the working sale route.
// - broward.deedauction.net: Broward's former tax deed portal,
//   superseded July 2026 by the move to RealAuction. Stale — excluded.

export interface AuctionSource {
  name: string;
  url: string;
  operator: string; // who runs it — agency, clerk, or commercial platform
  covers: string;   // what is sold there, in one line
}

export interface AuctionGroup {
  title: string;
  sources: AuctionSource[];
}

export const AUCTION_DIRECTORY_VERIFIED_AT = 'Nov 3, 2026';

export const AUCTION_GROUPS: AuctionGroup[] = [
  {
    title: 'Federal property sales — agency-owned homes & land',
    sources: [
      { name: 'HUD HomeStore', url: 'https://www.hudhomestore.gov', operator: 'U.S. Dept. of Housing & Urban Development', covers: 'HUD/FHA foreclosed single-family homes; offers go through HUD-registered brokers.' },
      { name: 'Fannie Mae HomePath', url: 'https://homepath.fanniemae.com/', operator: 'Fannie Mae', covers: 'Fannie Mae-owned foreclosed homes (REO).' },
      { name: 'Freddie Mac HomeSteps', url: 'https://www.homesteps.com', operator: 'Freddie Mac', covers: 'Freddie Mac foreclosed homes, incl. First Look buyer programs.' },
      { name: 'USDA RD/FSA Resales', url: 'https://properties.sc.egov.usda.gov/resales/public/aboutUs', operator: 'USDA Rural Development / Farm Service Agency', covers: 'Government-owned single-family, multi-family, and farm & ranch properties for public sale.' },
      { name: 'VA Property Management (official VA page)', url: 'https://www.benefits.va.gov/homeloans/realtors_property_mgmt.asp', operator: 'U.S. Dept. of Veterans Affairs', covers: "VA's own page for VA-acquired properties; points to the VA's contracted listing site below." },
      { name: 'VRM Properties', url: 'https://www.vrmproperties.com/', operator: 'VA contractor — commercial site, not a .gov', covers: 'The actual VA REO listing inventory, incl. Vendee™ financing-eligible properties.' },
      { name: 'FDIC — Real Estate & Property Sales', url: 'https://www.fdic.gov/asset-sales/real-estate-and-property-sales', operator: 'FDIC', covers: 'Real estate retained from failed banks — residential, commercial, land — sold via brokers, auctions, and direct sales. Inventory is episodic.' },
      { name: 'FDIC — Bargain Properties', url: 'https://www.fdic.gov/index.php/asset-sales/bargain-properties', operator: 'FDIC', covers: 'FDIC direct-sale bargain properties, sold as-is; often none available — check back after bank failures.' },
    ],
  },
  {
    title: 'Federal auctions — surplus & seized real property',
    sources: [
      { name: 'GSA Real Estate Sales', url: 'https://realestatesales.gov', operator: 'General Services Administration', covers: 'Surplus federal land and buildings sold to the public by competitive sale.' },
      { name: 'Treasury Auctions', url: 'https://home.treasury.gov/services/treasury-auctions/', operator: 'U.S. Dept. of the Treasury', covers: 'Seized/forfeited property auctions — IRS (real estate, vehicles, merchandise) and TEOAF (real estate and general property).' },
    ],
  },
  {
    title: 'Government surplus platforms — commercial, labeled as such',
    sources: [
      { name: 'GovDeals', url: 'https://govdeals.com/', operator: 'Commercial platform (Liquidity Services)', covers: 'State & local government surplus auctions, including a real estate category.' },
      { name: 'Public Surplus', url: 'https://publicsurplus.com/', operator: 'Commercial platform', covers: 'Government surplus auctions; mostly vehicles & equipment, with occasional real property lots.' },
    ],
  },
  {
    title: 'Florida clerk sales — foreclosure (Ch. 45) & tax deeds (Ch. 197)',
    sources: [
      { name: 'Realauction — client directory', url: 'https://www.realauction.com/clients/index', operator: 'Commercial platform used by Florida clerks', covers: 'The directory of clerk sale sites on the RealForeclose / RealTaxDeed platform — find any participating county here.' },
      { name: 'Broward County — foreclosure sales', url: 'https://broward.realforeclose.com/', operator: 'Broward Clerk of Courts (RealForeclose)', covers: 'Broward judicial foreclosure auctions, online.' },
      { name: 'Broward County — tax deed sales', url: 'https://broward.realtaxdeed.com/', operator: 'Broward County Records, Taxes & Treasury (RealTaxDeed)', covers: 'Broward tax deed auctions, online since the July 2026 move to RealAuction. Live-browser confirmed Nov 3, 2026.' },
      { name: 'St. Lucie County — foreclosure sales', url: 'https://stlucie.realforeclose.com/', operator: 'St. Lucie Clerk of Court (RealForeclose)', covers: 'St. Lucie judicial foreclosure auctions, online. Live-browser confirmed Nov 3, 2026.' },
      { name: 'Charlotte County — foreclosure & tax deed sales', url: 'https://www.charlotte.realforeclose.com/', operator: 'Charlotte Clerk of Courts (RealForeclose)', covers: 'Charlotte runs BOTH foreclosure and tax deed sales on this one site. Live-browser confirmed Nov 3, 2026.' },
      { name: 'Palm Beach County — tax deed sales', url: 'https://palmbeach.realtaxdeed.com/', operator: 'Palm Beach Clerk & Comptroller (RealTaxDeed)', covers: 'Palm Beach tax deed auctions, online.' },
      { name: 'Palm Beach Clerk — foreclosure information', url: 'https://www.mypalmbeachclerk.com/departments/courts/foreclosures/general-information', operator: 'Palm Beach Clerk & Comptroller (official)', covers: "The Clerk's official explainer for its online foreclosure and tax deed sales, with registration links. Separate accounts for foreclosure vs. tax deed sales." },
      { name: 'St. Lucie Clerk — foreclosures', url: 'https://stlucieclerk.gov/services/auctions/foreclosure', operator: 'St. Lucie Clerk of Court (official)', covers: "The Clerk's foreclosure page; sales are held online at RealAuction and administered by Real Foreclose." },
      { name: 'St. Lucie Clerk — tax deeds', url: 'https://stlucieclerk.gov/services/auctions/tax-deeds', operator: 'St. Lucie Clerk of Court (official)', covers: "The Clerk's tax deed page (Fla. Stat. Ch. 197); sales held online at RealAuction." },
      { name: 'Charlotte Clerk — tax deed services', url: 'https://taxdeeds.charlotteclerk.com/TaxDeed/Information', operator: 'Charlotte Clerk of Courts (official)', covers: "The Clerk's tax deed page; Charlotte runs BOTH tax deed and foreclosure sales online through its RealForeclose site, linked from this page." },
    ],
  },
];
