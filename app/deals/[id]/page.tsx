'use client';

// Slice 132 — Public deal detail page (/deals/[id]).
//
// Sections, modeled on the STRUCTURE of a public off-market deal
// detail (property facts, deal details, condition + rehab budget,
// ARV range, sold comparables, investment highlights, ZIP-only
// location, submitted-by, respond). No text, listings, prices, or
// photos are copied from any other marketplace — every fact is
// from OUR published_deals row, entered by the wholesaler who
// published it.
//
//   * Property facts grid, deal details, condition + rehab
//     budget, ARV range — from the row; blank reads "not provided".
//   * Sold comparables — wholesaler-entered only (max 4), every
//     comp field optional; blank reads "not provided", never
//     invented.
//   * Investment highlights — the wholesaler's own words.
//   * Location — ZIP area only. The street address is hidden.
//     The map centers on the Census ZCTA centroid for the deal's
//     ZIP (TIGERweb boundary via /api/boundary) with the ZCTA
//     polygon; no precise point is ever shown for a public deal.
//   * Demographics (Census ACS by ZIP via /api/demographics) and
//     HUD Fair Market Rent (county via /api/fmr) — every number
//     from the live API or "not provided"; a missing key reads
//     "needs a free Census API key" / "needs a free HUD token".
//     FHFA HPI trend is NOT shown: FHFA publishes no free API,
//     only static spreadsheet downloads — a trend line would be
//     faked, so there is none.
//   * Flood zone — checked live at the ZIP-area center point via
//     /api/flood-zone (FEMA NFHL layer 28) and labeled as such:
//     it is the zone at the ZIP center, NOT the property itself
//     (the street address is hidden). "Not checked" when FEMA has
//     no mapped zone at that point or the lookup fails.
//   * Matching buyers (N) — real count from real rows only via
//     lib/match-buy-box.ts (findMatchingBuyers). When signed in,
//     each match shows the buyer's display name + company from
//     their storefront profile when one exists (the same public
//     fields the /buyers directory shows; blank when the buyer has
//     no storefront profile — never invented), plus the buy-box
//     criteria (markets, ZIPs, property types, price range, rehab
//     tolerance). No contact details: contact stays private until
//     mutual opt-in. "No matching buyers yet." when the list is
//     empty.
//   * Respond to this deal — signed-in users only; writes
//     deal_responses. Contact is shown only when BOTH sides have
//     shared (owner_contact_shared AND responder_contact_shared),
//     the JV mutual-opt-in pattern. The responder may add an
//     optional contact line to their response; it is stored after
//     a delimiter in the message field (the spec'd
//     deal_responses columns carry no contact column) and is
//     rendered ONLY when both flags are true. There is no in-app
//     chat. NOTE (for the coordinator): with the spec'd columns
//     only the responder's contact can be revealed after mutual
//     opt-in — the owner's contact has no column, so the buyer is
//     told the owner can now see their contact and will reach out.
//   * The deal owner sees an Unpublish button (and Republish when
//     the deal is unpublished).

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import {
  fetchPublishedDealById,
  fetchMyPublishedDealById,
  fetchResponsesForDeal,
  fetchMyDealResponses,
  respondToDeal,
  shareContact,
  unpublishDeal,
  republishDeal,
  type PublishedDeal,
  type DealResponse,
} from '../../../lib/published-deals';
import { findMatchingBuyers, type BuyBoxForMatching } from '../../../lib/match-buy-box';
import {
  submitOffer,
  fetchOffersForDeal,
  fetchMyOffersForDeal,
  fetchBuyerPublicNames,
  decideOffer,
  withdrawOffer,
  CONTRACT_PREFILL_HANDOFF_KEY,
  type DealOffer,
  type BuyerPublicName,
} from '../../../lib/deal-offers';
import { countyByName } from '../../../lib/property-lookup';
import PropertyMap from '../../../components/PropertyMap';
import DealAttentionStats from '../../../components/DealAttentionStats';
import DealStatusBadge from '../../../components/DealStatusBadge';
import CopyDealToOblButton from '../../../components/CopyDealToOblButton';
import { updateDealStatus, normalizeDealStatus, DEAL_STATUSES, type DealStatus } from '../../../lib/deal-status';

const money = (n: number | null | undefined): string =>
  n == null ? 'not provided' : `$${Math.round(n).toLocaleString()}`;

const val = (v: string | number | null | undefined): string => {
  if (v == null || v === '') return 'not provided';
  return String(v);
};

// The responder's optional contact rides in the message after
// this delimiter (deal_responses has no contact column). The
// public message renders always; the contact part renders ONLY
// when both share flags are true.
const CONTACT_DELIM = '\n---contact---\n';

function splitResponseMessage(stored: string | null | undefined): { message: string; contact: string } {
  const raw = stored || '';
  const i = raw.indexOf(CONTACT_DELIM);
  if (i < 0) return { message: raw, contact: '' };
  return { message: raw.slice(0, i), contact: raw.slice(i + CONTACT_DELIM.length).trim() };
}

interface DemographicsState {
  mode?: string;
  population?: number | null;
  medianIncome?: number | null;
  housingUnits?: number | null;
  ownerOccupied?: number | null;
  renterOccupied?: number | null;
  medianHomeValue?: number | null;
  medianGrossRent?: number | null;
  year?: number;
  error?: string;
}

interface FmrState {
  mode?: string;
  year?: string | null;
  countyName?: string | null;
  metroName?: string | null;
  efficiency?: number | null;
  oneBedroom?: number | null;
  twoBedroom?: number | null;
  threeBedroom?: number | null;
  fourBedroom?: number | null;
  error?: string;
}

interface FloodState {
  mode?: string;
  zone?: string | null;
  zoneSubtype?: string | null;
  inSfha?: boolean | null;
  error?: string;
}

interface BoundaryState {
  centroid?: { lat: number; lng: number } | null;
  geojson?: { type: string; features?: unknown[] } | null;
  name?: string | null;
  error?: string;
}

export default function DealDetailPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [deal, setDeal] = useState<PublishedDeal | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [responses, setResponses] = useState<DealResponse[]>([]);
  const [matches, setMatches] = useState<BuyBoxForMatching[] | null>(null);
  const [demographics, setDemographics] = useState<DemographicsState | null>(null);
  const [fmr, setFmr] = useState<FmrState | null>(null);
  const [flood, setFlood] = useState<FloodState | null>(null);
  const [boundary, setBoundary] = useState<BoundaryState | null>(null);
  const [respondMsg, setRespondMsg] = useState('');
  const [respondContact, setRespondContact] = useState('');
  const [respondErr, setRespondErr] = useState('');
  const [respondDone, setRespondDone] = useState('');
  // Slice 133 — buyer offers on this deal. Money fields start
  // EMPTY — no price, EMD, or date is ever pre-filled.
  const [offers, setOffers] = useState<DealOffer[]>([]);
  const [offerNames, setOfferNames] = useState<Record<string, BuyerPublicName>>({});
  const [offerPrice, setOfferPrice] = useState('');
  const [offerEmd, setOfferEmd] = useState('');
  const [offerClose, setOfferClose] = useState('');
  const [offerErr, setOfferErr] = useState('');
  const [offerDone, setOfferDone] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    let live = true;
    async function load() {
      setLoading(true);
      try {
        let row = await fetchPublishedDealById(id);
        let uid: string | null = null;
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          uid = data.session?.user?.id || null;
          setUserId(uid);
          setUserEmail(data.session?.user?.email || null);
        }
        if (!row && uid) {
          row = await fetchMyPublishedDealById(id);
        }
        if (!live) return;
        if (!row) {
          setNotFound(true);
          return;
        }
        setDeal(row);
        // Matching buyers — real count from real rows only.
        try {
          const found = await findMatchingBuyers({
            county: row.county || null,
            zip: row.zip || null,
            property_type: row.property_type || null,
            asking_price: row.asking_price ?? null,
            condition: row.condition || null,
            state: row.state || null,
          });
          if (live) setMatches(found);
        } catch {
          if (live) setMatches([]);
        }
        // Responses: the owner reads responses on their own deal;
        // anyone else reads only their own response to this deal.
        if (uid && row.user_id === uid) {
          fetchResponsesForDeal(row.id!).then((r) => {
            if (live) setResponses(r);
          }).catch(() => {});
        } else if (uid) {
          fetchMyDealResponses(uid).then((r) => {
            if (live) setResponses(r.filter((x) => x.deal_id === row!.id));
          }).catch(() => {});
        }
        // Slice 133 — offers: the owner reads every offer on their
        // deal (with the makers' public names); anyone else reads
        // only their own offers on this deal. Signed-out visitors
        // read no offers at all.
        if (uid && row.user_id === uid) {
          fetchOffersForDeal(row.id!)
            .then((o) => {
              if (!live) return;
              setOffers(o);
              const ids = o.map((x) => x.buyer_id).filter((x): x is string => !!x);
              if (ids.length > 0) {
                fetchBuyerPublicNames(ids).then((n) => {
                  if (live) setOfferNames(n);
                }).catch(() => {});
              }
            })
            .catch(() => {});
        } else if (uid) {
          fetchMyOffersForDeal(uid, row.id!).then((o) => {
            if (live) setOffers(o);
          }).catch(() => {});
        }
        // Demographics by ZIP (public route; key-optional).
        if (row.zip && /^\d{5}$/.test(row.zip)) {
          fetch(`/api/demographics?zip=${row.zip}`)
            .then((r) => r.json())
            .then((j) => {
              if (live) setDemographics(j as DemographicsState);
            })
            .catch(() => {
              if (live) setDemographics({ error: 'Demographics could not be loaded.' });
            });
          // ZIP-area boundary (TIGERweb ZCTA) for the map, then a
          // flood-zone check at the ZIP-area center point.
          fetch(`/api/boundary?zip=${row.zip}`)
            .then((r) => r.json())
            .then((j) => {
              if (!live) return;
              const b = j as BoundaryState;
              setBoundary(b);
              const c = b.centroid;
              if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
                fetch(`/api/flood-zone?lat=${c.lat}&lng=${c.lng}`)
                  .then((r2) => r2.json())
                  .then((j2) => {
                    if (live) setFlood(j2 as FloodState);
                  })
                  .catch(() => {
                    if (live) setFlood({ error: 'Flood zone could not be checked.' });
                  });
              }
            })
            .catch(() => {
              if (live) setBoundary({ error: 'ZIP boundary could not be loaded.' });
            });
        }
        // HUD Fair Market Rent by county (registry FIPS only —
        // the 10 counties the build brief verified; anything else
        // reads "not provided" rather than a guessed FIPS).
        const countyEntry = row.county ? countyByName(row.county) : undefined;
        if (countyEntry?.fips) {
          fetch(`/api/fmr?countyFips=${countyEntry.fips}`)
            .then((r) => r.json())
            .then((j) => {
              if (live) setFmr(j as FmrState);
            })
            .catch(() => {
              if (live) setFmr({ error: 'Fair Market Rent could not be loaded.' });
            });
        }
      } catch (e) {
        if (live) setErr((e as Error)?.message || 'This deal could not be loaded.');
      } finally {
        if (live) setLoading(false);
      }
    }
    load();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isOwner = !!userId && !!deal && deal.user_id === userId;
  // Slice 133 (deal status) — offers are open only while the deal
  // is Active ('Active' | 'Under Contract' | 'Sold' from sibling
  // migration 20261117144000). A missing status — the column not
  // yet applied, or an older row — reads as Active. The owner side
  // is unaffected: deciding existing offers and drafting the
  // assignment from an accepted offer stay available whatever the
  // status is.
  const dealStatus = deal?.status || 'Active';
  const offersOpen = dealStatus === 'Active';
  const myResponse = responses.find((r) => r.responder_id === userId);

  const submitResponse = async () => {
    if (!userId || !deal?.id) return;
    setRespondErr('');
    setRespondDone('');
    try {
      const stored =
        respondContact.trim() === ''
          ? respondMsg.trim()
          : `${respondMsg.trim()}${CONTACT_DELIM}${respondContact.trim()}`;
      const row = await respondToDeal(userId, deal.id, stored);
      setResponses((prev) => [...prev, row]);
      setRespondDone('Response sent. Your contact is shared with the deal owner only after you both opt in below.');
      setRespondMsg('');
      setRespondContact('');
    } catch (e) {
      setRespondErr((e as Error)?.message || 'Your response could not be sent.');
    }
  };

  const shareMyContact = async (responseId: string, side: 'owner' | 'responder') => {
    setMsg('');
    try {
      await shareContact(responseId, side);
      setResponses((prev) =>
        prev.map((r) =>
          r.id === responseId
            ? { ...r, owner_contact_shared: side === 'owner' ? true : r.owner_contact_shared, responder_contact_shared: side === 'responder' ? true : r.responder_contact_shared }
            : r
        )
      );
      setMsg('Contact sharing saved. Contact is shown only when both sides have shared.');
    } catch (e) {
      setMsg((e as Error)?.message || 'Contact sharing did not save.');
    }
  };

  // Slice 133 — submit an offer. Money fields start empty and
  // stay empty until the buyer types them; lib/deal-offers.ts
  // rejects a missing or non-positive price. The form is hidden
  // when the deal is not Active, and this guard is the second
  // lock — a submit with a closed deal does nothing.
  const submitOfferForm = async () => {
    if (!userId || !deal?.id || !offersOpen) return;
    setOfferErr('');
    setOfferDone('');
    try {
      const row = await submitOffer(userId, deal.id, {
        offer_price: offerPrice.trim() === '' ? null : Number(offerPrice.replace(/[^0-9.]/g, '')),
        emd_amount: offerEmd.trim() === '' ? null : Number(offerEmd.replace(/[^0-9.]/g, '')),
        closing_date: offerClose.trim() === '' ? null : offerClose.trim(),
      });
      setOffers((prev) => [...prev, row]);
      setOfferDone('Offer sent to the deal owner. They can accept or decline it here.');
      setOfferPrice('');
      setOfferEmd('');
      setOfferClose('');
    } catch (e) {
      setOfferErr((e as Error)?.message || 'Your offer could not be sent.');
    }
  };

  // Slice 133 — the deal owner accepts or declines a pending
  // offer. Only the owner sees these buttons; RLS refuses anyone
  // else, and decideOffer throws instead of looking decided.
  const decide = async (offer: DealOffer, decision: 'accepted' | 'declined') => {
    if (!offer.id) return;
    setMsg('');
    try {
      await decideOffer(offer.id, decision);
      setOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, status: decision } : o)));
      setMsg(
        decision === 'accepted'
          ? 'Offer accepted — draft the assignment contract from it below.'
          : 'Offer declined.'
      );
    } catch (e) {
      setMsg((e as Error)?.message || 'The offer could not be decided.');
    }
  };

  // Slice 133 — the offering buyer withdraws their own pending
  // offer. Only the buyer sees this button.
  const withdraw = async (offer: DealOffer) => {
    if (!offer.id) return;
    setMsg('');
    try {
      await withdrawOffer(offer.id);
      setOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, status: 'withdrawn' } : o)));
      setMsg('Offer withdrawn.');
    } catch (e) {
      setMsg((e as Error)?.message || 'The offer could not be withdrawn.');
    }
  };

  // Slice 133, item 5 — draft the assignment from an ACCEPTED
  // offer. One click hands the offer's real terms to the EXISTING
  // assignment contract generator (buildAssignmentContract via
  // WholesaleContractGenerator) on the dashboard: assignor = the
  // deal owner (the generator fills the wholesaler from their own
  // storefront profile), assignee = the buyer who made the
  // accepted offer (public name/company when they have a
  // storefront profile, blank otherwise — never invented),
  // price = the accepted offer price, closing date + EMD = the
  // offer's own terms. The assignment fee is NEVER carried here —
  // the wholesaler enters it in the generator, which will not
  // print without it. The seller name and property address are
  // NOT carried either: a published deal holds no street address
  // and no seller name by design, so the wholesaler types them in
  // the generator. The handoff travels by localStorage (the deal
  // page is a separate route from the dashboard, which has no
  // cross-page prefill channel); app/page.tsx consumes the key,
  // checks the signed-in user still owns the deal, and opens the
  // contracts view.
  const draftAssignmentFromOffer = (offer: DealOffer) => {
    if (!deal?.id || !offer.id || offer.status !== 'accepted') return;
    const name = offer.buyer_id ? offerNames[offer.buyer_id] : undefined;
    const handoff = {
      doc: 'assignment',
      purchasePrice: offer.offer_price,
      closingDate: offer.closing_date || undefined,
      assignmentEmdAmount: offer.emd_amount ?? null,
      endBuyerName: name?.display_name || undefined,
      endBuyerEntity: name?.company_name || undefined,
      city: deal.city || undefined,
      county: deal.county || undefined,
      dealId: deal.id,
      offerId: offer.id,
    };
    try {
      localStorage.setItem(CONTRACT_PREFILL_HANDOFF_KEY, JSON.stringify(handoff));
    } catch {
      setMsg('Your browser blocked saving the draft — try again.');
      return;
    }
    window.location.assign('/');
  };

  const doUnpublish = async () => {
    if (!userId || !deal?.id) return;
    setMsg('');
    try {
      await unpublishDeal(userId, deal.id);
      setDeal({ ...deal, published: false });
      setMsg('Unpublished — this deal no longer appears on the public deals page.');
    } catch (e) {
      setMsg((e as Error)?.message || 'The deal could not be unpublished.');
    }
  };

  const doRepublish = async () => {
    if (!userId || !deal?.id) return;
    setMsg('');
    try {
      await republishDeal(userId, deal.id);
      setDeal({ ...deal, published: true });
      setMsg('Re-published — this deal is on the public deals page again.');
    } catch (e) {
      setMsg((e as Error)?.message || 'The deal could not be re-published.');
    }
  };

  if (loading) {
    return (
      <main style={{ maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ fontSize: 14, color: '#cbd5e1' }}>Loading deal…</p>
      </main>
    );
  }

  if (notFound || !deal) {
    return (
      <main style={{ maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ fontSize: 13 }}><Link href="/deals">← All deals</Link></p>
        <h1 style={{ fontSize: 24 }}>Deal not found.</h1>
        <p style={{ fontSize: 14, color: '#cbd5e1' }}>
          This deal may have been unpublished, or the link is wrong. {err || ''}
        </p>
      </main>
    );
  }

  const comps = Array.isArray(deal.comps) ? deal.comps.slice(0, 4) : [];
  const bothShared = (r: DealResponse) => !!r.owner_contact_shared && !!r.responder_contact_shared;
  const center = boundary?.centroid || null;

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/deals">← All deals</Link> · <Link href="/#signin">Sign in</Link>
      </p>
      {deal.published === false && isOwner && (
        <p style={{ fontSize: 14, background: '#fef3c7', color: '#0f172a', border: '1px solid #fbbf24', borderRadius: 8, padding: '10px 12px' }}>
          This deal is unpublished — only you can see it here.
        </p>
      )}
      <h1 style={{ fontSize: 26, margin: '8px 0 4px' }}>
        {deal.property_type || 'Property'} in {deal.city || 'City not given'}
        {deal.state ? `, ${deal.state}` : ''}
      </h1>
      <p style={{ fontSize: 14, color: '#cbd5e1', marginTop: 0 }}>
        Asking price <strong>{money(deal.asking_price)}</strong>
        {' · '}
        <DealStatusBadge status={deal.status} />
        {deal.strategy ? ` · ${deal.strategy}` : ''}
        {deal.condition ? ` · ${deal.condition}` : ''}
        {deal.created_at ? ` · Published ${new Date(deal.created_at).toLocaleDateString()}` : ''}
      </p>
      {msg && <p style={{ fontSize: 14 }}>{msg}</p>}

      {/* Slice 133 — public buyer-invite CTA. Visible at the top of
          the deal, without scrolling. It routes to
          /join?role=buyer; /join reads the role from the URL query
          (Slice 133) and the click also stashes 'buyer' in
          localStorage 'ws_pending_role' as a fallback for the join
          cards and AuthPanel.
          Honest labeling: buyers register THEMSELVES — the
          platform never registers buyers for anyone, and nobody
          is auto-added. A registered buy box lets the buyer's own
          portal show deals that match what they buy; no alerts
          are promised, because the app sends none. */}
      {!isOwner && (
        <div style={{ background: '#ecfdf5', color: '#0f172a', border: '1px solid #6ee7b7', borderRadius: 10, padding: '14px 16px', marginTop: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Want deals like this one?</p>
          <p style={{ fontSize: 14, color: '#475569', margin: '0 0 10px' }}>
            Register your buy box — tell us what and where you buy, and your portal shows deals that match.
            You register yourself; nobody is added for you.
          </p>
          <a
            href="/join?role=buyer"
            onClick={() => {
              try {
                localStorage.setItem('ws_pending_role', 'buyer');
              } catch {
                // No storage — the link still works, signup just
                // defaults its role.
              }
            }}
            style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 8, background: '#0f766e', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
          >
            Get deals like this — register your buy box
          </a>
        </div>
      )}

      {/* Slice 133 — real attention stats for this deal (views counted
          server-side, responses counted live, days on market from the
          real created_at, price drops only from recorded history). */}
      <DealAttentionStats dealId={deal.id} createdAt={deal.created_at} askingPrice={deal.asking_price} />
      <h2 style={{ fontSize: 18, marginTop: 24 }}>Property facts</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
        <div><div style={{ fontSize: 12, color: '#64748b' }}>Property type</div><div>{val(deal.property_type)}</div></div>
        <div><div style={{ fontSize: 12, color: '#64748b' }}>Condition</div><div>{val(deal.condition)}</div></div>
        <div><div style={{ fontSize: 12, color: '#64748b' }}>Occupancy</div><div>{val(deal.occupancy)}</div></div>
        <div><div style={{ fontSize: 12, color: '#64748b' }}>Strategy</div><div>{val(deal.strategy)}</div></div>
        <div><div style={{ fontSize: 12, color: '#64748b' }}>Bedrooms</div><div>{deal.beds ?? 'not provided'}</div></div>
        <div><div style={{ fontSize: 12, color: '#64748b' }}>Bathrooms</div><div>{deal.baths ?? 'not provided'}</div></div>
        <div><div style={{ fontSize: 12, color: '#64748b' }}>Square footage</div><div>{deal.sqft != null ? deal.sqft.toLocaleString() : 'not provided'}</div></div>
        <div><div style={{ fontSize: 12, color: '#64748b' }}>Year built</div><div>{deal.year_built ?? 'not provided'}</div></div>
        <div><div style={{ fontSize: 12, color: '#64748b' }}>Lot size</div><div>{val(deal.lot_size)}</div></div>
        <div><div style={{ fontSize: 12, color: '#64748b' }}>Close by</div><div>{deal.close_by || 'not provided'}</div></div>
      </div>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Off-market deal details</h2>
      <div style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
        <p style={{ margin: '4px 0' }}>Asking price: <strong>{money(deal.asking_price)}</strong></p>
        <p style={{ margin: '4px 0' }}>
          Estimated ARV: <strong>
            {deal.arv_low == null && deal.arv_high == null
              ? 'not provided'
              : deal.arv_low != null && deal.arv_high != null
                ? `${money(deal.arv_low)}–${money(deal.arv_high)}`
                : money(deal.arv_low ?? deal.arv_high)}
          </strong>
        </p>
        <p style={{ margin: '4px 0' }}>Condition: {val(deal.condition)}</p>
        <p style={{ margin: '4px 0' }}>Estimated rehab budget: <strong>{money(deal.repair_estimate)}</strong></p>
        {deal.notes && <p style={{ margin: '8px 0 0', fontSize: 14, overflowWrap: 'break-word' }}>{deal.notes}</p>}
      </div>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Sold comparables</h2>
      <div style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 0 }}>Entered by the wholesaler who published this deal — never pulled from another site.</p>
        {comps.length === 0 ? (
          <p style={{ fontSize: 14 }}>No comparables provided.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {comps.map((c, i) => (
              <li key={i} style={{ marginBottom: 10, fontSize: 14, overflowWrap: 'break-word' }}>
                <strong>{c.address || 'Address not provided'}</strong>
                {c.sold_price != null ? ` — Sold for ${money(c.sold_price)}` : ' — Sold price not provided'}
                <br />
                <span style={{ color: '#475569' }}>
                  {c.beds != null ? `${c.beds} bed` : 'Beds not provided'} / {c.baths != null ? `${c.baths} bath` : 'Baths not provided'}
                  {' | '}
                  {c.sqft != null ? `${c.sqft.toLocaleString()} sq ft` : 'Sq ft not provided'}
                  {' | '}
                  {c.sold_date || 'Sold date not provided'}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {deal.highlights && (
        <>
          <h2 style={{ fontSize: 18, marginTop: 24 }}>Investment highlights</h2>
          <div style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
            <p style={{ margin: 0, fontSize: 14, overflowWrap: 'break-word' }}>{deal.highlights}</p>
          </div>
        </>
      )}

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Location</h2>
      <div style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
        <p style={{ margin: '0 0 8px', fontSize: 14 }}>
          {deal.city || 'City not given'}
          {deal.state ? `, ${deal.state}` : ''} {deal.zip || ''}
          {deal.county ? ` · ${deal.county} County` : ''}
        </p>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 10px' }}>
          Map shows the approximate ZIP area. Street address is hidden.
        </p>
        {center && boundary?.geojson ? (
          <PropertyMap
            center={center}
            zoom={13}
            markerLabel={`Approximate ZIP area ${deal.zip || ''} — street address hidden.`}
            boundaryGeojson={boundary.geojson}
            boundaryLabel={`ZIP ${deal.zip || ''} area (U.S. Census TIGERweb)`}
          />
        ) : (
          <p style={{ fontSize: 14 }}>Map not available for this ZIP.</p>
        )}
      </div>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Neighborhood &amp; rent check</h2>
      <div style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, fontSize: 14 }}>
        <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Demographics — ZIP {deal.zip || 'not given'}</h3>
        {demographics?.error ? (
          <p>{demographics.error}</p>
        ) : demographics?.mode === 'not_configured' ? (
          <p>Demographics need a free Census API key — the operator has not added one yet, so no numbers are shown here.</p>
        ) : demographics?.mode === 'ok' ? (
          <p style={{ margin: '4px 0' }}>
            Population: {demographics.population?.toLocaleString() ?? 'not provided'} · Median household income:{' '}
            {demographics.medianIncome != null ? `$${demographics.medianIncome.toLocaleString()}` : 'not provided'}
            <br />
            Housing units: {demographics.housingUnits?.toLocaleString() ?? 'not provided'} · Owner-occupied:{' '}
            {demographics.ownerOccupied?.toLocaleString() ?? 'not provided'} · Renter-occupied:{' '}
            {demographics.renterOccupied?.toLocaleString() ?? 'not provided'}
            <br />
            Median home value: {demographics.medianHomeValue != null ? `$${demographics.medianHomeValue.toLocaleString()}` : 'not provided'}
            {' '}· Median gross rent: {demographics.medianGrossRent != null ? `$${demographics.medianGrossRent.toLocaleString()}` : 'not provided'}
            <br />
            <span style={{ fontSize: 12, color: '#64748b' }}>U.S. Census Bureau, American Community Survey {demographics.year} 5-year, ZIP Code Tabulation Area.</span>
          </p>
        ) : (
          <p>Loading demographics…</p>
        )}

        <h3 style={{ fontSize: 15, margin: '14px 0 6px' }}>Fair Market Rent — {deal.county ? `${deal.county} County` : 'county not given'}</h3>
        {fmr?.error ? (
          <p>{fmr.error}</p>
        ) : fmr?.mode === 'not_configured' ? (
          <p>Fair Market Rent needs a free HUD token — the operator has not added one yet, so no rents are shown here.</p>
        ) : fmr?.mode === 'ok' ? (
          <p style={{ margin: '4px 0' }}>
            {fmr.countyName || fmr.metroName || ''}{fmr.year ? ` (${fmr.year})` : ''}: Efficiency{' '}
            {fmr.efficiency != null ? `$${fmr.efficiency.toLocaleString()}` : 'not provided'} · 1-bed{' '}
            {fmr.oneBedroom != null ? `$${fmr.oneBedroom.toLocaleString()}` : 'not provided'} · 2-bed{' '}
            {fmr.twoBedroom != null ? `$${fmr.twoBedroom.toLocaleString()}` : 'not provided'} · 3-bed{' '}
            {fmr.threeBedroom != null ? `$${fmr.threeBedroom.toLocaleString()}` : 'not provided'} · 4-bed{' '}
            {fmr.fourBedroom != null ? `$${fmr.fourBedroom.toLocaleString()}` : 'not provided'}
            <br />
            <span style={{ fontSize: 12, color: '#64748b' }}>U.S. Department of Housing and Urban Development, Fair Market Rents. This product uses the HUD User Data API but is not endorsed or certified by HUD User.</span>
          </p>
        ) : (
          <p>Fair Market Rent not provided — the county FIPS code is not on file for this county.</p>
        )}

        <h3 style={{ fontSize: 15, margin: '14px 0 6px' }}>Flood zone</h3>
        {flood?.error ? (
          <p>{flood.error}</p>
        ) : flood?.mode === 'ok' ? (
          <p style={{ margin: '4px 0' }}>
            Zone <strong>{flood.zone}</strong>
            {flood.zoneSubtype ? ` (${flood.zoneSubtype})` : ''}
            {flood.inSfha === true ? ' — in a Special Flood Hazard Area' : flood.inSfha === false ? ' — outside the Special Flood Hazard Area' : ''}
            <br />
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Checked at the ZIP-area center point (the street address is hidden), not the property itself. From FEMA&apos;s effective
              flood map (National Flood Hazard Layer). This is not a Standard Flood Hazard Determination, not a prediction of whether
              a building will flood, and not an insurance quote.
            </span>
          </p>
        ) : flood?.mode === 'no_data' ? (
          <p>Flood zone not checked — FEMA has no mapped flood hazard zone at the ZIP-area center point.</p>
        ) : (
          <p>Checking flood zone…</p>
        )}
      </div>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>
        Matching buyers ({matches == null ? '…' : matches.length})
      </h2>
      <div style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
        {matches == null ? (
          <p style={{ fontSize: 14 }}>Loading matches…</p>
        ) : matches.length === 0 ? (
          <p style={{ fontSize: 14, margin: 0 }}>No matching buyers yet.</p>
        ) : (
          <>
            <p style={{ fontSize: 14, marginTop: 0 }}>
              {matches.length} {matches.length === 1 ? 'buyer' : 'buyers'} published a buy box matching this deal. Buyer contact
              stays private until mutual opt-in.
            </p>
            {!userId && <p style={{ fontSize: 14 }}><Link href="/#signin">Sign in</Link> to see the matching buy-box details.</p>}
            {userId && (
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                {matches.map((b, i) => (
                  <li key={`${b.user_id}-${i}`} style={{ marginBottom: 8 }}>
                    {(b.display_name || b.company_name) && (
                      <>
                        <strong>
                          {b.display_name}
                          {b.display_name && b.company_name ? ' — ' : ''}
                          {b.company_name}
                        </strong>
                        <br />
                      </>
                    )}
                    Markets: {b.markets.length > 0 ? b.markets.join(', ') : 'any'}
                    {b.zip_codes.length > 0 ? ` · ZIPs: ${b.zip_codes.join(', ')}` : ''}
                    <br />
                    Types: {b.property_types.length > 0 ? b.property_types.join(', ') : 'any'}
                    {' · '}Price: {b.min_price != null ? `$${b.min_price.toLocaleString()}` : 'no minimum'}
                    {' – '}
                    {b.max_price != null ? `$${b.max_price.toLocaleString()}` : 'no maximum'}
                    {b.rehab_tolerance ? ` · Rehab tolerance: ${b.rehab_tolerance}` : ''}
                    {b.states.length > 0 ? ` · States: ${b.states.join(', ')}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Submitted by</h2>
      <div style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
        <p style={{ fontSize: 14, margin: 0 }}>Contact info is shared in private conversations when you choose.</p>
        {isOwner ? (
          <>
            <p style={{ fontSize: 14 }}>This is your deal.</p>
            {deal.published !== false ? (
              <button onClick={doUnpublish} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' }}>
                Unpublish this deal
              </button>
            ) : (
              <button onClick={doRepublish} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                Re-publish this deal
              </button>
            )}
            {/* Slice 133 — owner-only deal status changer + Copy Deal
                & Open OBL. The changer writes via updateDealStatus
                (owner-only server-side); a refused save rolls the
                badge back and says so. */}
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
                Deal status
                <select
                  value={normalizeDealStatus(deal.status)}
                  onChange={async (e) => {
                    const next = e.target.value as DealStatus;
                    const prev = normalizeDealStatus(deal.status);
                    setDeal({ ...deal, status: next });
                    try {
                      await updateDealStatus(userId, deal.id!, next);
                      setMsg(next === 'Active' ? 'Deal is Active — it stays open to offers.' : `Deal is now ${next} — new offers are blocked on it.`);
                    } catch (err) {
                      setDeal({ ...deal, status: prev });
                      setMsg((err as Error)?.message || 'The deal status could not be changed.');
                    }
                  }}
                  style={{ display: 'block', marginTop: 3, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
                >
                  {DEAL_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ marginTop: 12 }}>
              <CopyDealToOblButton deal={deal} />
            </div>
            {responses.length > 0 && (
              <>
                <h3 style={{ fontSize: 15, margin: '16px 0 6px' }}>Responses ({responses.length})</h3>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                  {responses.map((r) => {
                    const parts = splitResponseMessage(r.message);
                    const shared = bothShared(r);
                    return (
                      <li key={r.id} style={{ marginBottom: 10 }}>
                        {parts.message || '(no message)'}
                        {r.created_at ? ` · ${new Date(r.created_at).toLocaleDateString()}` : ''}
                        <br />
                        {shared && parts.contact ? (
                          <span>Buyer contact (both sides shared): <strong>{parts.contact}</strong></span>
                        ) : (
                          <span style={{ color: '#64748b' }}>
                            Contact shared: buyer {r.responder_contact_shared ? 'yes' : 'not yet'} · you{' '}
                            {r.owner_contact_shared ? 'yes' : 'not yet'}
                            {!r.owner_contact_shared && (
                              <button onClick={() => shareMyContact(r.id!, 'owner')} style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid #0f766e', background: '#fff', color: '#0f766e', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                                Share my contact with this buyer
                              </button>
                            )}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        ) : userId ? (
          <>
            {myResponse ? (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 14 }}>You already responded to this deal.</p>
                {!myResponse.responder_contact_shared && (
                  <button onClick={() => shareMyContact(myResponse.id!, 'responder')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                    Share my contact with the deal owner
                  </button>
                )}
                {myResponse.responder_contact_shared && !myResponse.owner_contact_shared && (
                  <p style={{ fontSize: 14, color: '#64748b' }}>You shared your contact — the owner sees it once they share theirs.</p>
                )}
                {bothShared(myResponse) && (
                  <p style={{ fontSize: 14, color: '#0f766e' }}>
                    Both sides shared contact — the owner can now see your contact and will reach out.
                  </p>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Respond to this deal</h3>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
                  Message to the deal owner
                  <textarea
                    value={respondMsg}
                    onChange={(e) => setRespondMsg(e.target.value)}
                    rows={3}
                    style={{ display: 'block', width: '100%', marginTop: 3, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                  />
                </label>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
                  Your contact (email or phone — optional; shown to the owner only after you both opt in)
                  <input
                    value={respondContact}
                    onChange={(e) => setRespondContact(e.target.value)}
                    style={{ display: 'block', width: '100%', marginTop: 3, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                  />
                </label>
                {respondErr && <p style={{ fontSize: 13, color: '#b91c1c' }}>{respondErr}</p>}
                {respondDone && <p style={{ fontSize: 13, color: '#0f766e' }}>{respondDone}</p>}
                <button
                  onClick={submitResponse}
                  disabled={respondMsg.trim() === ''}
                  style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Respond to this deal
                </button>
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: 14 }}>
            <Link href="/#signin">Sign in</Link> to respond to this deal.
          </p>
        )}
      </div>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Offers</h2>
      <div style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
        {!userId ? (
          offersOpen ? (
            <p style={{ fontSize: 14, margin: 0 }}>
              <Link href="/#signin">Sign in to make an offer</Link> on this deal.
            </p>
          ) : (
            <p style={{ fontSize: 14, margin: 0 }}>
              This deal is {dealStatus} — offers are closed.
            </p>
          )
        ) : isOwner ? (
          <>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 0 }}>
              Offers on your deal are visible only to you, the buyer who made each one, and the operator.
            </p>
            {offers.length === 0 ? (
              <p style={{ fontSize: 14, margin: 0 }}>No offers yet.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                {offers.map((o) => {
                  const name = o.buyer_id ? offerNames[o.buyer_id] : undefined;
                  const buyerLabel = name?.display_name
                    ? `${name.display_name}${name.company_name ? ` — ${name.company_name}` : ''}`
                    : 'Buyer (no public profile)';
                  return (
                    <li key={o.id} style={{ marginBottom: 14 }}>
                      <strong>{money(o.offer_price)}</strong>
                      {' · '}EMD: {o.emd_amount != null ? money(o.emd_amount) : 'not provided'}
                      {' · '}Close by: {o.closing_date || 'not provided'}
                      <br />
                      <span style={{ color: '#475569' }}>
                        {buyerLabel}
                        {o.created_at ? ` · ${new Date(o.created_at).toLocaleDateString()}` : ''}
                        {' · '}Status: {o.status || 'pending'}
                      </span>
                      {o.status === 'pending' && (
                        <span style={{ display: 'block', marginTop: 6 }}>
                          <button onClick={() => decide(o, 'accepted')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                            Accept offer
                          </button>{' '}
                          <button onClick={() => decide(o, 'declined')} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' }}>
                            Decline
                          </button>
                        </span>
                      )}
                      {o.status === 'accepted' && (
                        <span style={{ display: 'block', marginTop: 6 }}>
                          <button onClick={() => draftAssignmentFromOffer(o)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                            Draft assignment contract
                          </button>
                          <span style={{ display: 'block', fontSize: 13, color: '#64748b', marginTop: 4 }}>
                            Opens the assignment draft with this offer&apos;s price. Enter the assignment fee and the
                            property address there — the form will not print without them.
                          </span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <>
            {offersOpen ? (
              <>
                <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Make an offer</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 0 }}>
              Your offer goes to the deal owner only. No other buyer sees it, and an accepted offer is a
              decision in the app — nothing is filed, sent, or signed here.
            </p>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
              Offer price ($) *
              <input
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                placeholder=""
                inputMode="decimal"
                style={{ display: 'block', width: '100%', marginTop: 3, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
              Earnest money ($) — optional
              <input
                value={offerEmd}
                onChange={(e) => setOfferEmd(e.target.value)}
                placeholder=""
                inputMode="decimal"
                style={{ display: 'block', width: '100%', marginTop: 3, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
              Closing date — optional
              <input
                type="date"
                value={offerClose}
                onChange={(e) => setOfferClose(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 3, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
              />
            </label>
            {offerErr && <p style={{ fontSize: 13, color: '#b91c1c' }}>{offerErr}</p>}
            {offerDone && <p style={{ fontSize: 13, color: '#0f766e' }}>{offerDone}</p>}
            <button
              onClick={submitOfferForm}
              disabled={offerPrice.trim() === ''}
              style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: offerPrice.trim() === '' ? 'not-allowed' : 'pointer', opacity: offerPrice.trim() === '' ? 0.5 : 1 }}
            >
              Submit offer
              </button>
              </>
            ) : (
              <p style={{ fontSize: 14, margin: 0 }}>
                This deal is {dealStatus} — offers are closed.
              </p>
            )}
            {offers.length > 0 && (
              <>
                <h3 style={{ fontSize: 15, margin: '16px 0 6px' }}>Your offers on this deal ({offers.length})</h3>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                  {offers.map((o) => (
                    <li key={o.id} style={{ marginBottom: 10 }}>
                      <strong>{money(o.offer_price)}</strong>
                      {' · '}EMD: {o.emd_amount != null ? money(o.emd_amount) : 'not provided'}
                      {' · '}Close by: {o.closing_date || 'not provided'}
                      {' · '}Status: {o.status || 'pending'}
                      {o.status === 'pending' && (
                        <>
                          {' '}
                          <button onClick={() => withdraw(o)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer', fontSize: 12 }}>
                            Withdraw
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      <p style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 24 }}>
        WholesalingOS is a connection platform, not a broker, lender, title company, or legal advisor. Asking prices, ARV, and repair
        estimates are supplied by the submitter — confirm the property&apos;s condition and supporting estimates with the submitter before
        making a decision.
      </p>
      <p style={{ fontSize: 13, color: '#cbd5e1' }}>Signed in as: {userEmail || 'not signed in'}</p>
    </main>
  );
}
