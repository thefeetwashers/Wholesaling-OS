'use client';
import React, { useEffect, useState } from 'react';
import {
  BOOTCAMP,
  DAY7_QUIZ,
  DAY7_PASS_MARK,
  loadMySchoolProgress,
  loadMySchoolBadge,
  completeSchoolDay,
  passDay7Quiz,
  type SchoolProgress,
} from '../lib/school';
import { supabase } from '../lib/supabase';

const CTA_URL = 'https://wholesalingos.thefeetwashers.com/';

// Slice 122 — WholesalingOS School 7-Day Deal Launch Bootcamp.
// Publicly readable lessons; interactive progress only for signed-in
// users. Days 1–6 are marked complete by the reader. Day 7 is
// completed only by passing the 5-question quiz (4 of 5 to pass),
// which sets the Verified Operator badge on the day-7 progress row.
// The badge means exactly "completed the 7-day bootcamp and passed
// the Day 7 check" — never a license or regulatory certification.
export default function SchoolBootcamp() {
  const [userId, setUserId] = useState<string | null>(null);
  const [progress, setProgress] = useState<SchoolProgress[]>([]);
  const [hasBadge, setHasBadge] = useState(false);
  const [day, setDay] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    if (!supabase) return;
    supabase
      .auth.getUser()
      .then(({ data }) => {
        const id = data?.user?.id || null;
        if (!live) return;
        setUserId(id);
        if (id) {
          loadMySchoolProgress(id).then(setProgress).catch(() => {});
          loadMySchoolBadge(id).then(setHasBadge).catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const completedDays = new Set(progress.filter((p) => p.completed_at).map((p) => p.day_number));
  const current = BOOTCAMP[day - 1];
  const isDone = completedDays.has(day);

  const markComplete = async () => {
    if (!userId) {
      setErr('Sign in to track your bootcamp progress — the lessons are free to read either way.');
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await completeSchoolDay(userId, day);
      setProgress((p) => [...p.filter((r) => r.day_number !== day), { user_id: userId, day_number: day, completed_at: new Date().toISOString(), verified_operator_badge: false }]);
      setMsg(`Day ${day} marked complete.`);
      if (day < 7) setDay(day + 1);
    } catch (ex: any) {
      setErr(ex?.message || 'Could not save your progress.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {BOOTCAMP.map((d) => (
          <button
            key={d.day}
            onClick={() => {
              setDay(d.day);
              setMsg('');
              setErr('');
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 999,
              border: `1px solid ${day === d.day ? '#0f766e' : '#cbd5e1'}`,
              background: day === d.day ? '#0f766e' : completedDays.has(d.day) ? '#ccfbf1' : '#fff',
              color: day === d.day ? '#fff' : '#0f172a',
              fontWeight: day === d.day ? 700 : 600,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {completedDays.has(d.day) ? '✓ ' : ''}Day {d.day}
          </button>
        ))}
      </div>

      {hasBadge && (
        <p style={{ display: 'inline-block', fontSize: 13, fontWeight: 700, color: '#0f766e', background: '#ccfbf1', border: '1px solid #99f6e4', borderRadius: 999, padding: '6px 12px', margin: '0 0 12px' }}>
          ✓ Verified Operator — Completed the 7-day bootcamp and passed the Day 7 check
        </p>
      )}
      {!userId && (
        <p style={{ fontSize: 13, color: '#475569', margin: '0 0 12px' }}>
          The lessons below are free to read. Sign in to track your progress and earn the Verified Operator badge.
        </p>
      )}

      <article>
        <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>
          {current.icon} Day {current.day} — {current.title}
        </h2>
        <p style={{ fontSize: 14, color: '#475569', margin: '0 0 4px' }}>{current.dek}</p>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>About {current.minutes} minutes to read.</p>
        {current.steps.map((s, i) => (
          <section key={i} style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>{s.h}</h3>
            {s.body.map((p, j) => (
              <p key={j} style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, margin: '0 0 8px' }}>
                {p}
              </p>
            ))}
          </section>
        ))}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
          {current.links.map((l) => (
            <a
              key={l.href + l.label}
              href={l.href}
              style={{ fontSize: 13, fontWeight: 600, color: '#0f766e', textDecoration: 'underline' }}
            >
              {l.label} →
            </a>
          ))}
        </div>
        <div style={{ border: '1px solid #99f6e4', background: '#f0fdfa', borderRadius: 10, padding: 14, marginTop: 12 }}>
          <p style={{ fontSize: 14, margin: '0 0 8px' }}>
            <strong>Put it to work:</strong> the calculators, the lists, and the office are waiting.
          </p>
          <a
            href={CTA_URL}
            style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 8, background: '#0f766e', color: '#fff', fontWeight: 700, textDecoration: 'none' }}
          >
            Start my 90 days free →
          </a>
        </div>
        {day < 7 ? (
          <div style={{ marginTop: 16 }}>
            {err && <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}
            {msg && <p style={{ color: '#0f766e', fontSize: 13 }}>{msg}</p>}
            <button
              onClick={markComplete}
              disabled={busy || isDone}
              style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: isDone ? '#94a3b8' : '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
            >
              {isDone ? `✓ Day ${day} complete` : busy ? 'Saving…' : `Mark Day ${day} complete`}
            </button>
            {day < 7 && (
              <button
                onClick={() => setDay(day + 1)}
                style={{ marginLeft: 8, padding: '10px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Next: Day {day + 1} →
              </button>
            )}
          </div>
        ) : (
          <Day7Quiz
            userId={userId}
            alreadyPassed={hasBadge || isDone}
            onPassed={() => {
              setHasBadge(true);
              setProgress((p) => [
                ...p.filter((r) => r.day_number !== 7),
                { user_id: userId || '', day_number: 7, completed_at: new Date().toISOString(), verified_operator_badge: true },
              ]);
            }}
          />
        )}
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day 7 quiz — 5 questions, pass mark 4 of 5, stated on the quiz.
// Passing stamps day 7 complete and sets the Verified Operator badge.
// ---------------------------------------------------------------------------

function Day7Quiz({
  userId,
  alreadyPassed,
  onPassed,
}: {
  userId: string | null;
  alreadyPassed: boolean;
  onPassed: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  if (alreadyPassed && !submitted) {
    return (
      <div style={{ border: '1px solid #99f6e4', background: '#f0fdfa', borderRadius: 10, padding: 14, marginTop: 16 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>✓ Day 7 check passed</h3>
        <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>
          You completed the 7-day bootcamp and passed the Day 7 check. Your Wholesaler profile and your JV Deal Room listings now show the
          ✓ Verified Operator badge. The badge means you finished the bootcamp and passed the check — it is not a license or a regulatory
          certification.
        </p>
      </div>
    );
  }

  const submit = async () => {
    const s = DAY7_QUIZ.reduce((acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0), 0);
    setScore(s);
    setSubmitted(true);
    setErr('');
    if (s >= DAY7_PASS_MARK) {
      if (!userId) {
        setErr('You passed — sign in to record the result and earn the badge.');
        return;
      }
      setBusy(true);
      try {
        await passDay7Quiz(userId);
        setSaved(true);
        onPassed();
      } catch (ex: any) {
        setErr(ex?.message || 'Your pass could not be saved. Try again.');
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#fff', marginTop: 16 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Day 7 check — 5 questions</h3>
      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 12px' }}>
        Answer {DAY7_PASS_MARK} of 5 correctly to pass. Passing marks Day 7 complete and earns the ✓ Verified Operator badge on your
        Wholesaler profile and your JV Deal Room listings. The badge means you completed the 7-day bootcamp and passed this check — it is
        not a license or a regulatory certification.
      </p>
      {DAY7_QUIZ.map((q, i) => (
        <fieldset key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 8, margin: '0 0 10px', padding: '10px 12px' }}>
          <legend style={{ fontSize: 14, fontWeight: 700 }}>
            {i + 1}. {q.question}
          </legend>
          {q.options.map((opt, j) => (
            <label key={j} style={{ display: 'block', fontSize: 13, margin: '6px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                name={`q${i}`}
                checked={answers[i] === j}
                onChange={() => setAnswers((p) => ({ ...p, [i]: j }))}
                disabled={submitted && score >= DAY7_PASS_MARK}
              />{' '}
              {opt}
              {submitted && j === q.answer && <span style={{ color: '#0f766e', fontWeight: 700 }}> ✓</span>}
              {submitted && answers[i] === j && j !== q.answer && <span style={{ color: '#b91c1c', fontWeight: 700 }}> ✕</span>}
            </label>
          ))}
          {submitted && <p style={{ fontSize: 12, color: '#475569', margin: '6px 0 0' }}>{q.why}</p>}
        </fieldset>
      ))}
      {submitted && (
        <p style={{ fontSize: 14, fontWeight: 700, color: score >= DAY7_PASS_MARK ? '#0f766e' : '#b91c1c' }}>
          You scored {score} of 5.{' '}
          {score >= DAY7_PASS_MARK
            ? saved
              ? 'Passed — your Verified Operator badge is live.'
              : 'Passed.'
            : 'Not yet — read the explanations above and try again.'}
        </p>
      )}
      {err && <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}
      {!submitted || score < DAY7_PASS_MARK ? (
        <button
          onClick={submit}
          disabled={busy || Object.keys(answers).length < 5}
          style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy ? 'Saving…' : submitted ? 'Try again' : 'Submit my answers'}
        </button>
      ) : null}
    </div>
  );
}
