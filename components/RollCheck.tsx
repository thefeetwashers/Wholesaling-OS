'use client';

// Slice 114 — Check the roll (per lead). One tap asks the lit
// state roll about this lead — by parcel ID when the lead carries
// one, otherwise by surname search with the lead's address matched
// among the answer (no lit roll answers an address search) — and
// stamps the verdict into the lead's notes via the ordinary lead
// update, then hands the new notes to the parent list so an
// immediate edit cannot overwrite the stamp with stale text. The verdict language
// is lib/roll-check.ts, whose rules never claim more than the
// roll's answer established. A lead in a state with no lit roll
// gets a plain line saying so when it carries a parcel or owner to
// check; anything else renders nothing.

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { updateLeadFields, type Lead } from '../lib/leads';
import {
  ROLL_CHECK_STATES,
  buildRollStamp,
  surnameQuery,
  type RollAnswer,
} from '../lib/roll-check';
import type { StateRecord } from '../lib/state-records';

export default function RollCheck({
  userId,
  lead,
  onStamped,
}: {
  userId: string;
  lead: Lead;
  onStamped?: (notes: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [notes, setNotes] = useState(lead.notes || '');

  const stateCode = (lead.state || '').trim().toUpperCase();
  const rollState = ROLL_CHECK_STATES[stateCode];
  const hasParcel = !!(lead.parcel_id && lead.parcel_id.trim());
  const hasOwner = !!(lead.owner_name && lead.owner_name.trim());

  if (!rollState) {
    if (stateCode && (hasParcel || hasOwner)) {
      return (
        <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 6 }}>
          🔎 Roll check: no live roll for {stateCode} yet — the lit rolls are FL, CT, MA, WI, DC, CO.
        </div>
      );
    }
    return null;
  }
  if (!hasParcel && !hasOwner) {
    return (
      <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 6 }}>
        🔎 Roll check: add a parcel ID or an owner name to check this lead against the {stateCode} roll.
      </div>
    );
  }

  const run = async () => {
    if (!lead.id) return;
    setBusy(true);
    setMsg('');
    try {
      if (!supabase) {
        setMsg('Roll check needs sign-in sync, which is not configured on this deployment.');
        return;
      }
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setMsg('Sign in to check the roll.');
        return;
      }
      // Query shape (Slice 114, corrected by its own verification):
      // parcel ID first. A parcel-less lead is checked by owner
      // name in surname form — no lit roll answers an address
      // search, a full multi-token name times Florida's index out,
      // and the punctuated surname-first names on the other rolls
      // ("SMITH, ROSA L") break a full-phrase search anyway. The
      // lead's address is then matched among the answer.
      const mode = hasParcel ? 'parcel' : 'owner';
      const q = hasParcel
        ? (lead.parcel_id as string)
        : surnameQuery(lead.owner_name as string);
      const res = await fetch(
        `/api/state-records?state=${rollState}&mode=${mode}&q=${encodeURIComponent(q)}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      const j = (await res.json()) as { records?: StateRecord[]; exact?: boolean; error?: string };
      if (j.error) {
        setMsg(j.error);
        return;
      }
      const answer: RollAnswer = { records: j.records || [], exact: !!j.exact };
      const stamp = buildRollStamp({
        today: new Date().toISOString().slice(0, 10),
        state: rollState,
        mode,
        leadParcel: lead.parcel_id || '',
        leadOwner: lead.owner_name || '',
        leadAddress: lead.property_address || '',
        queryLabel: q,
        answer,
      });
      const nextNotes = notes.trim() ? `${notes.replace(/\s+$/, '')} ${stamp}` : stamp;
      await updateLeadFields(userId, lead.id, { notes: nextNotes });
      setNotes(nextNotes);
      // Refresh the parent list's copy of this lead in-session, so
      // the Edit form opened right after shows the stamped notes —
      // and saving an edit cannot silently overwrite the stamp
      // with the pre-check text (Slice 114 fix, live-observed).
      if (onStamped) onStamped(nextNotes);
      setMsg(`${stamp} Stamped into this lead’s notes.`);
    } catch {
      setMsg('The roll check could not be completed just now — the roll may be slow; try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 6 }}>
      <button type="button" onClick={() => void run()} disabled={busy} style={{ fontSize: 13 }}>
        {busy ? '🔎 Checking the roll…' : `🔎 Check the roll (${stateCode})`}
      </button>
      {msg ? (
        <div style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 4, maxWidth: 640 }}>{msg}</div>
      ) : null}
    </div>
  );
}
