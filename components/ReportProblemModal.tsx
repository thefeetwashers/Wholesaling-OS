'use client';

// Slice 130 — Report a Problem. Any signed-in user can file a
// report from the dashboard; the row goes to the operator's desk
// in the app (OperatorStats), where the operator triages it. The
// app NEVER emails — no email service is wired — and the modal
// says so plainly. Category, subject, and details are the report;
// the page you were on is recorded as context only. Nothing is
// pre-filled: the subject and details start empty.

import { useState } from 'react';
import {
  PROBLEM_CATEGORIES,
  submitProblemReport,
  type ProblemCategory,
} from '../lib/problem-reports';

export default function ReportProblemModal({
  userId,
  pageContext,
  onClose,
}: {
  userId: string;
  pageContext: string;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<ProblemCategory>('listing');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    setErr('');
    setSaving(true);
    try {
      await submitProblemReport(userId, { category, subject, details, pageContext });
      setSaved(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The report did not save — try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.8)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 16px',
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 12, padding: 20, maxWidth: 560, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Report a problem</h3>
        {saved ? (
          <>
            <p style={{ fontSize: 14 }}>
              Your report was saved to the operator&apos;s desk. The operator reviews reports in the app — nothing was emailed, because this platform does not send email.
            </p>
            <button onClick={onClose}>Close</button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>
              Your report goes to the operator&apos;s desk in the app. The app does not send email — the operator reads it here.
              {' '}Page: {pageContext || 'dashboard'}.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ fontSize: 13 }}>
                What is it about?{' '}
                <select value={category} onChange={(e) => setCategory(e.target.value as ProblemCategory)}>
                  {PROBLEM_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 13 }}>
                Short subject
                <input
                  style={{ width: '100%', marginTop: 4 }}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Short summary, e.g. Wrong address on a listing"
                />
              </label>
              <label style={{ fontSize: 13 }}>
                Describe the problem
                <textarea
                  style={{ width: '100%', marginTop: 4, minHeight: 110 }}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Describe the problem"
                />
              </label>
            </div>
            {err && <p style={{ fontSize: 13, color: '#f87171' }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={submit} disabled={saving || !subject.trim() || !details.trim()}>
                {saving ? 'Saving…' : 'Send report to the operator'}
              </button>
              <button onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
