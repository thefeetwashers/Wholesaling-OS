import { createHash, createHmac } from 'crypto';

// Server-only mail sender (Slices 44/45 provider layer, SES build
// Nov 8, 2026 — owner decision: direct Amazon SES instead of Resend
// for the app's email). Imported ONLY by API routes; never by client
// components. Provider order: SES when its keys are present, else
// Resend when its key is present, else mail is dark (null) and every
// caller stays quiet — dark is a state, never a simulation.
//
// SES is called through its v2 REST API with a hand-built AWS
// Signature Version 4 header — no SDK dependency, the same plain
// fetch style the Twilio and Resend branches already use.
//
// Env: AWS_SES_ACCESS_KEY_ID, AWS_SES_SECRET_ACCESS_KEY,
// AWS_SES_REGION (default us-east-1), AWS_SES_FROM or SEND_FROM_EMAIL
// (default WholesalingOS <noreply@wholesalingos.thefeetwashers.com>),
// RESEND_API_KEY (fallback only).

export type MailProvider = 'ses' | 'resend';

const SES_ID = process.env.AWS_SES_ACCESS_KEY_ID || '';
const SES_SECRET = process.env.AWS_SES_SECRET_ACCESS_KEY || '';
const SES_REGION = process.env.AWS_SES_REGION || 'us-east-1';
const RESEND_KEY = process.env.RESEND_API_KEY || '';

export function mailProvider(): MailProvider | null {
  if (SES_ID && SES_SECRET) return 'ses';
  if (RESEND_KEY) return 'resend';
  return null;
}

export function mailFrom(): string {
  return (
    process.env.AWS_SES_FROM ||
    process.env.SEND_FROM_EMAIL ||
    'WholesalingOS <noreply@wholesalingos.thefeetwashers.com>'
  );
}

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const hmac = (key: Buffer | string, s: string) => createHmac('sha256', key).update(s, 'utf8').digest();

async function sendViaSes(to: string, subject: string, text: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const host = `email.${SES_REGION}.amazonaws.com`;
  const path = '/v2/email/outbound-emails';
  const body = JSON.stringify({
    FromEmailAddress: mailFrom(),
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: text, Charset: 'UTF-8' } },
      },
    },
  });

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-date';
  const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${SES_REGION}/ses/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  const kDate = hmac('AWS4' + SES_SECRET, dateStamp);
  const kRegion = hmac(kDate, SES_REGION);
  const kService = hmac(kRegion, 'ses');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${SES_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const r = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'X-Amz-Date': amzDate,
      'content-type': 'application/json',
    },
    body,
  });
  const j = (await r.json().catch(() => ({}))) as { MessageId?: string; message?: string };
  if (!r.ok) return { ok: false, error: `SES refused the send: ${j.message || `HTTP ${r.status}`}` };
  return { ok: true, id: j.MessageId };
}

async function sendViaResend(to: string, subject: string, text: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: mailFrom(), to: [to], subject, text }),
  });
  const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!r.ok) return { ok: false, error: `Resend refused the send: ${j.message || `HTTP ${r.status}`}` };
  return { ok: true, id: j.id };
}

export async function sendMail(to: string, subject: string, text: string): Promise<{ ok: boolean; id?: string; error?: string; provider: MailProvider | null }> {
  const provider = mailProvider();
  if (!provider) return { ok: false, provider: null, error: 'Email is not connected yet.' };
  try {
    const res = provider === 'ses' ? await sendViaSes(to, subject, text) : await sendViaResend(to, subject, text);
    return { ...res, provider };
  } catch (e) {
    return { ok: false, provider, error: e instanceof Error ? e.message : 'Send failed.' };
  }
}
