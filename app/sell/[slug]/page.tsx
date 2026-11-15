'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  loadPublicSellerPage,
  type PublicSellerPage,
  type SellerLeadForm,
} from '../../../lib/portals';
import {
  loadPublicStorefront,
  submitSellerLeadStep1,
  completeSellerLead,
  PROPERTY_TYPES,
  CONDITIONS,
  OCCUPANCIES,
  TIMELINES,
  type StorefrontProfile,
} from '../../../lib/storefront';
import VoiceIntake from '../../../components/VoiceIntake';
import StorefrontHeader from '../../../components/StorefrontHeader';
import StorefrontTrust from '../../../components/StorefrontTrust';
import { loadPublicWholesalerStats } from '../../../lib/trust';

// Public seller landing page (Slice 20, rebuilt Slice 124):
// /sell/<slug> under the wholesaler's own company name. No account
// needed. The submission becomes a lead in that wholesaler's CRM.
//
// Slice 124 — two-step capture:
//   Step 1 (the hook): name + phone + email + property address.
//   The lead is saved IMMEDIATELY as a partial lead, so a seller
//   who abandons the form still leaves a follow-up-able lead in
//   the wholesaler's dashboard ("Partial — step 1 only").
//   Step 2 (details): city/state/ZIP, property type, condition,
//   occupancy, timeline, asking price, photos, and the optional
//   questions. Completing step 2 clears the partial flag.
// The voice intake is untouched (it posts to /api/intake, which
// creates the lead server-side). The privacy/assignment disclosure
// stays on the form — it is a legal disclosure.

const EMPTY: SellerLeadForm = {
  owner_name: '', property_address: '', city: '', state: '', zip: '',
  phone: '', email: '', notes: '', website: '',
};

const MAX_STEP2_PHOTOS = 5;

function ToggleRow({
  label, options, value, onPick,
}: {
  label: string;
  options: string[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>{label}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onPick(value === o ? '' : o)}
            style={{
              padding: '8px 14px', borderRadius: 999, fontSize: 13.5, cursor: 'pointer',
              background: value === o ? '#4ade80' : '#1e293b',
              color: value === o ? '#052e16' : '#e2e8f0',
              border: value === o ? '1px solid #4ade80' : '1px solid #334155',
              fontWeight: value === o ? 700 : 400,
            }}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SellerPage() {
  const params = useParams();
  const slug = String((params as { slug?: string })?.slug || '');
  const [page, setPage] = useState<PublicSellerPage | null>(null);
  const [profile, setProfile] = useState<StorefrontProfile | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [step, setStep] = useState<1 | 2>(1);
  const [f, setF] = useState<SellerLeadForm>(EMPTY);
  const [consent, setConsent] = useState(false);
  // Slice 63 — condition questionnaire. The answers ride inside the
  // lead's notes (no fabricated repair estimates); the wholesaler
  // underwrites, the form only asks. Slice 124: the repairs and
  // timeline questions are now the step-2 toggles, so this keeps
  // roof / heating & cooling / reason only.
  const [q, setQ] = useState({ roof: '', hvac: '', reason: '' });
  const [d2, setD2] = useState({ property_type: '', condition: '', occupancy: '', timeline: '', asking_price: '' });
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoDrag, setPhotoDrag] = useState(false);
  const [sent, setSent] = useState(false);
  // Slice 84 — after a successful submission the seller may attach
  // photos of the property; they post to /api/seller-photo, which
  // re-verifies this page + the fresh lead server-side.
  const [leadId, setLeadId] = useState('');
  const [photoNote, setPhotoNote] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [closedCount, setClosedCount] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!slug) return;
    loadPublicWholesalerStats(slug).then(setClosedCount).catch(() => {});
    loadPublicStorefront(slug).then(setProfile).catch(() => {});
    loadPublicSellerPage(slug)
      .then((p) => { if (p) { setPage(p); setState('ready'); } else setState('missing'); })
      .catch(() => setState('missing'));
  }, [slug]);

  // Slice 124 — per-storefront local SEO: title + description from
  // the wholesaler's name and service areas.
  useEffect(() => {
    if (!page) return;
    const areas = profile?.service_areas?.length ? ` in ${profile.service_areas.slice(0, 3).join(', ')}` : '';
    document.title = `${page.company} — We Buy Houses${areas} | WholesalingOS`;
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = `Sell your house as-is to ${page.company}${areas}. Fair cash offer, no repairs, no fees, close on your timeline.`;
  }, [page, profile]);

  const submitStep1 = async () => {
    if (!f.owner_name.trim() || !f.property_address.trim()) {
      setErr('Please add your name and the property address.');
      return;
    }
    setBusy(true);
    setErr('');
    const newLeadId = await submitSellerLeadStep1(slug, {
      owner_name: f.owner_name.trim(),
      property_address: f.property_address.trim(),
      phone: f.phone.trim(),
      email: f.email.trim(),
      consent: consent && !!f.phone.trim(),
    }, f.website);
    setBusy(false);
    if (newLeadId) {
      setLeadId(newLeadId);
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setErr('Your details could not be sent. Check the address and name, then try again.');
    }
  };

  const submitStep2 = async () => {
    if (!leadId) {
      setErr('Your first step did not save — please go back and send it again.');
      return;
    }
    setBusy(true);
    setErr('');
    const qLines = [
      q.roof && `Roof: ${q.roof}`,
      q.hvac && `HVAC: ${q.hvac}`,
      d2.condition && `Repairs needed: ${d2.condition}`,
      d2.timeline && `Timeline: ${d2.timeline}`,
      q.reason && `Reason for selling: ${q.reason}`,
    ].filter(Boolean) as string[];
    const notes = [
      qLines.length ? `Seller questionnaire — ${qLines.join(' · ')}` : '',
      consent && f.phone.trim() ? 'Contact consent: seller checked the box to be called/texted about this property.' : '',
      f.notes,
    ].filter(Boolean).join('\n');
    const asking = d2.asking_price.trim() ? Number(d2.asking_price.replace(/[$,]/g, '')) : null;
    const ok = await completeSellerLead(slug, leadId, {
      city: f.city.trim(),
      state: f.state.trim(),
      zip: f.zip.trim(),
      property_type: d2.property_type,
      condition: d2.condition,
      occupancy: d2.occupancy,
      timeline: d2.timeline,
      asking_price: asking !== null && Number.isFinite(asking) ? asking : null,
      notes,
    });
    if (!ok) {
      setBusy(false);
      setErr('Your details could not be finished — but your address and contact from step 1 are saved, and we will still reach out.');
      return;
    }
    // Step-2 photos ride the same sealed route as the post-submit
    // photo step (/api/seller-photo): verified server-side, private
    // lead-photos bucket, owner-only. Failures are reported
    // honestly — a failed upload never claims success.
    if (photos.length > 0) {
      const result = await uploadPhotos(photos);
      setPhotoNote(result);
    }
    setBusy(false);
    setSent(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadPhotos = async (files: File[]): Promise<string> => {
    let sentCount = 0;
    let failed = 0;
    for (const file of files) {
      const body = new FormData();
      body.append('slug', slug);
      body.append('lead_id', leadId);
      body.append('file', file);
      try {
        const res = await fetch('/api/seller-photo', { method: 'POST', body });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (res.ok && json?.ok) sentCount += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
    if (sentCount > 0 && failed === 0) return `${sentCount} photo${sentCount === 1 ? '' : 's'} sent to ${page?.company || 'the company'}.`;
    if (sentCount > 0) return `${sentCount} photo${sentCount === 1 ? '' : 's'} sent; ${failed} could not be sent — you can add them below.`;
    return 'Your photos could not be sent — you can try adding them below.';
  };

  const sendPhotos = async (files: FileList | null) => {
    if (!files || !leadId) return;
    setPhotoBusy(true);
    setPhotoNote('');
    const result = await uploadPhotos(Array.from(files));
    setPhotoNote(result);
    setPhotoBusy(false);
  };

  const addStep2Photos = (incoming: FileList | File[]) => {
    const list = Array.from(incoming).filter((file) => file.type.startsWith('image/'));
    const over = list.filter((file) => file.size > 5 * 1024 * 1024);
    const ok = list.filter((file) => file.size <= 5 * 1024 * 1024);
    const room = Math.max(0, MAX_STEP2_PHOTOS - photos.length);
    const take = ok.slice(0, room);
    if (over.length > 0) setErr('One photo is over 5 MB — it was left out.');
    else if (ok.length > room) setErr(`Up to ${MAX_STEP2_PHOTOS} photos here — the extras were left out. You can add more after sending.`);
    else setErr('');
    if (take.length > 0) setPhotos((prev) => [...prev, ...take]);
  };

  if (state === 'loading') {
    return <p style={{ fontSize: 14 }}>Loading…</p>;
  }

  if (state === 'missing' || !page) {
    return (
      <section style={{ background: '#16213a', padding: 24, borderRadius: 12 }}>
        <h1>This seller page isn’t available</h1>
        <p style={{ fontSize: 14 }}>
          The page you’re looking for is turned off or the address is wrong.
          Check the link with the company that sent it to you.
        </p>
      </section>
    );
  }

  const phone = profile?.public_phone?.trim() || '';

  if (sent) {
    return (
      <div>
        <section style={{ background: '#052e16', padding: 24, borderRadius: 12 }}>
          <h1>Thank you{f.owner_name ? `, ${f.owner_name.split(' ')[0]}` : ''}.</h1>
          <p style={{ fontSize: 15 }}>
            {page.company} received your property details and will reach out shortly.
            There’s nothing else you need to do.
          </p>
          {photoNote && <p style={{ fontSize: 14 }}>{photoNote}</p>}
          {leadId && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 14 }}>
                <strong>Optional:</strong> photos help {page.company} understand the property — the outside,
                any rooms or repairs you want them to see. Images only, up to 6, and they go only to
                {' '}{page.company}'s private file for this property.
              </p>
              <input type="file" accept="image/*" multiple disabled={photoBusy}
                onChange={(e) => { void sendPhotos(e.target.files); e.target.value = ''; }} />
              {photoBusy && <p style={{ fontSize: 13.5 }}>Sending…</p>}
              {photoNote && <p style={{ fontSize: 13.5 }}>{photoNote}</p>}
            </div>
          )}
        </section>
        <StorefrontTrust profile={profile} company={page.company} closedCount={closedCount} />
      </div>
    );
  }

  return (
    <div>
      <style>{`.ws-sticky-call{display:none} @media (max-width:640px){.ws-sticky-call{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:50;gap:8px;padding:10px 12px;background:#0f172a;border-top:1px solid #334155}.ws-sticky-call a{flex:1;text-align:center;padding:12px 8px;border-radius:8px;font-weight:700;text-decoration:none}.ws-sticky-spacer{display:block;height:64px}}`}</style>
      <StorefrontHeader page={page} profile={profile} />

      <VoiceIntake slug={slug} company={page.company} />

      <section style={{ background: '#16213a', padding: 20, borderRadius: 12 }}>
        <h2>Tell us about your property</h2>
        {step === 1 ? (
          <div>
            <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 0 }}>
              Step 1 of 2 — just the basics, and we will reach out with a fair cash offer.
              Your details go only to {page.company}.
            </p>
            <div>
              <input placeholder="Your full name *" value={f.owner_name}
                onChange={(e) => setF({ ...f, owner_name: e.target.value })} style={{ minWidth: 260 }} />
              <input placeholder="Phone" value={f.phone}
                onChange={(e) => setF({ ...f, phone: e.target.value })} />
              <input placeholder="Email" value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })} style={{ minWidth: 240 }} />
            </div>
            <div style={{ marginTop: 6 }}>
              <input placeholder="Property address *" value={f.property_address}
                onChange={(e) => setF({ ...f, property_address: e.target.value })} style={{ minWidth: 320 }} />
            </div>
            <label style={{ fontSize: 13, display: 'block', marginTop: 8 }}>
              <input type="checkbox" checked={consent}
                onChange={(e) => setConsent(e.target.checked)} />{' '}
              It&apos;s OK for {page.company} to call or text me about my property.
            </label>
            {/* Honeypot: invisible to people, filled by bots. Do not remove. */}
            <input type="text" name="website" value={f.website} autoComplete="off" tabIndex={-1}
              onChange={(e) => setF({ ...f, website: e.target.value })}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
            {err && <p style={{ fontSize: 13.5, color: '#fbbf24' }}>{err}</p>}
            <div style={{ marginTop: 10 }}>
              <button onClick={submitStep1} disabled={busy} style={{ fontSize: 15, padding: '10px 22px' }}>
                {busy ? 'Sending…' : 'Get My Cash Offer'}
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
              Your information goes only to {page.company} — it is never sold or shared with the
              platform. {page.company} may purchase your property directly or assign its purchase
              contract to another buyer; you’ll always know who you’re closing with before you sign.
            </p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 0 }}>
              Step 2 of 2 — a few details help price your offer accurately. Your address and
              contact from step 1 are already saved, so you can close this page any time and
              we will still reach out.
            </p>
            <div>
              <input placeholder="City" value={f.city}
                onChange={(e) => setF({ ...f, city: e.target.value })} />
              <input placeholder="State" value={f.state}
                onChange={(e) => setF({ ...f, state: e.target.value })} style={{ width: 90 }} />
              <input placeholder="ZIP" value={f.zip}
                onChange={(e) => setF({ ...f, zip: e.target.value })} style={{ width: 110 }} />
            </div>
            <ToggleRow label="Property type" options={PROPERTY_TYPES} value={d2.property_type}
              onPick={(v) => setD2({ ...d2, property_type: v })} />
            <ToggleRow label="Property condition" options={CONDITIONS} value={d2.condition}
              onPick={(v) => setD2({ ...d2, condition: v })} />
            <ToggleRow label="Who lives there now?" options={OCCUPANCIES} value={d2.occupancy}
              onPick={(v) => setD2({ ...d2, occupancy: v })} />
            <ToggleRow label="How soon would you like to sell?" options={TIMELINES} value={d2.timeline}
              onPick={(v) => setD2({ ...d2, timeline: v })} />
            <div style={{ marginTop: 8 }}>
              <input placeholder="Asking price (optional)" value={d2.asking_price}
                onChange={(e) => setD2({ ...d2, asking_price: e.target.value })} style={{ minWidth: 220 }} />
            </div>
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>
                Photos help your offer — snap up to {MAX_STEP2_PHOTOS} (roof, kitchen, major damage). They go only to {page.company}&apos;s private file for this property.
              </p>
              <div
                onDragOver={(e) => { e.preventDefault(); setPhotoDrag(true); }}
                onDragLeave={() => setPhotoDrag(false)}
                onDrop={(e) => { e.preventDefault(); setPhotoDrag(false); addStep2Photos(e.dataTransfer.files); }}
                style={{
                  border: `2px dashed ${photoDrag ? '#4ade80' : '#334155'}`, borderRadius: 12,
                  padding: 16, textAlign: 'center', cursor: 'pointer',
                }}
                onClick={() => document.getElementById('step2-photos')?.click()}
              >
                <p style={{ fontSize: 14, margin: 0 }}>📸 Drop photos here, or tap to choose from your phone</p>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>Images only, up to 5 MB each, up to {MAX_STEP2_PHOTOS} photos.</p>
                <input id="step2-photos" type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={(e) => { if (e.target.files) addStep2Photos(e.target.files); e.target.value = ''; }} />
              </div>
              {photos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {photos.map((file, i) => (
                    <div key={`${file.name}-${i}`} style={{ position: 'relative' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={URL.createObjectURL(file)} alt={file.name}
                        style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8 }} />
                      <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                        style={{ position: 'absolute', top: 2, right: 2, padding: '2px 8px' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>
                A few quick questions (optional) — your answers help price your offer accurately.
              </p>
              <select value={q.roof} onChange={(e) => setQ({ ...q, roof: e.target.value })}>
                <option value="">Roof age…</option>
                <option>Under 10 years old</option>
                <option>10–20 years old</option>
                <option>Over 20 years / needs work</option>
                <option>Not sure</option>
              </select>{' '}
              <select value={q.hvac} onChange={(e) => setQ({ ...q, hvac: e.target.value })}>
                <option value="">Heating &amp; cooling…</option>
                <option>Working</option>
                <option>Needs repair</option>
                <option>Not working / none</option>
                <option>Not sure</option>
              </select>{' '}
              <select value={q.reason} onChange={(e) => setQ({ ...q, reason: e.target.value })}>
                <option value="">Reason for selling…</option>
                <option>Relocating</option>
                <option>Inherited property</option>
                <option>Downsizing</option>
                <option>Behind on payments</option>
                <option>Tired of landlording</option>
                <option>Other / prefer not to say</option>
              </select>
            </div>
            <div style={{ marginTop: 6 }}>
              <textarea placeholder="Anything else we should know? Whatever you're comfortable sharing."
                value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })}
                rows={3} style={{ width: '100%', maxWidth: 620 }} />
            </div>
            {err && <p style={{ fontSize: 13.5, color: '#fbbf24' }}>{err}</p>}
            <div style={{ marginTop: 10 }}>
              <button onClick={submitStep2} disabled={busy} style={{ fontSize: 15, padding: '10px 22px' }}>
                {busy ? 'Sending…' : 'Complete my request'}
              </button>{' '}
              <button onClick={() => setStep(1)} disabled={busy} style={{ fontSize: 14, padding: '10px 16px' }}>
                Back
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
              Your information goes only to {page.company} — it is never sold or shared with the
              platform. {page.company} may purchase your property directly or assign its purchase
              contract to another buyer; you’ll always know who you’re closing with before you sign.
            </p>
          </div>
        )}
      </section>

      <StorefrontTrust profile={profile} company={page.company} closedCount={closedCount} />

      {phone && (
        <div className="ws-sticky-call">
          <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} style={{ background: '#4ade80', color: '#052e16' }}>📞 Call</a>
          <a href={`sms:${phone.replace(/[^+\d]/g, '')}`} style={{ background: '#1e293b', color: '#e2e8f0' }}>💬 Text for a faster offer</a>
        </div>
      )}
      {phone && <div className="ws-sticky-spacer" />}
    </div>
  );
}
