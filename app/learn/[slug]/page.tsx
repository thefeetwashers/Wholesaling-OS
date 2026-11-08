import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LESSONS, lessonBySlug } from '../../../lib/lessons';

// Slice 95 — one School lesson. Static-generated per lesson from
// lib/lessons.ts; an unknown slug is a 404, not a blank page.

export function generateStaticParams() {
  return LESSONS.map((l) => ({ slug: l.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const lesson = lessonBySlug(params.slug);
  if (!lesson) return { title: 'Lesson not found — WholesalingOS School' };
  return {
    title: `${lesson.title} — WholesalingOS School`,
    description: lesson.dek,
    alternates: { canonical: `/learn/${lesson.slug}` },
  };
}

const wrap: React.CSSProperties = { maxWidth: 820, margin: '0 auto' };
const panel: React.CSSProperties = { background: '#1e293b', padding: 20, borderRadius: 12, marginTop: 16 };
const p: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.7 };

export default function LessonPage({ params }: { params: { slug: string } }) {
  const lesson = lessonBySlug(params.slug);
  if (!lesson) notFound();
  return (
    <div style={wrap}>
      <p className="ws-buildtag">
        <a href="/learn" style={{ color: '#7dd3fc', textDecoration: 'none' }}>WholesalingOS School</a> — lesson
      </p>
      <section style={panel}>
        <div style={{ fontSize: 30 }}>{lesson.icon}</div>
        <h1>{lesson.title}</h1>
        <p style={{ ...p, color: '#cbd5e1' }}>{lesson.dek}</p>
        <p style={{ fontSize: 12.5, color: '#94a3b8' }}>About {lesson.minutes} minutes · WholesalingOS School</p>
        {lesson.steps.map((s, i) => (
          <div key={s.h}>
            <h3>{i + 1}. {s.h}</h3>
            {s.body.map((para) => <p key={para.slice(0, 32)} style={p}>{para}</p>)}
          </div>
        ))}
      </section>
      <section style={{ background: '#052e16', border: '1px solid #166534', padding: 20, borderRadius: 12, marginTop: 16 }}>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginTop: 0 }}>{lesson.cta}</p>
        <a href="/" style={{ display: 'inline-block', background: '#059669', color: '#fff', fontWeight: 700, padding: '11px 22px', borderRadius: 8, textDecoration: 'none' }}>
          Start your 90 days free
        </a>
        <p style={{ fontSize: 13, marginTop: 14 }}>
          <a href="/learn" style={{ color: '#7dd3fc' }}>← All lessons</a>
        </p>
      </section>
    </div>
  );
}
