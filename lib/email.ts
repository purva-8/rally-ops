import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';

// Set EMAIL_FROM to a sender you verified with your provider (e.g. "Samanvayam Khel Utsav <sports@yourdomain.com>").
// The default Resend sender only delivers to the Resend account owner.
export const EMAIL_FROM = process.env.EMAIL_FROM ?? 'RallyOps <onboarding@resend.dev>';

export type Mail = { to: string; subject: string; html: string; kind: string; tournamentId?: string | null };
export type SendResult = { ok: boolean; error?: string };

async function record(mails: Mail[], results: SendResult[]) {
  try {
    await createAdminClient().from('email_log').insert(
      mails.map((m, i) => ({
        kind: m.kind,
        to_email: m.to,
        subject: m.subject,
        tournament_id: m.tournamentId ?? null,
        status: results[i].ok ? 'sent' : results[i].error === 'Email is not configured' ? 'skipped' : 'failed',
        error: results[i].ok ? null : results[i].error ?? null,
      })),
    );
  } catch (err) {
    console.error('Could not write email_log:', err);
  }
}

function parseFrom(from: string) {
  const m = from.match(/^(.*)<(.+)>\s*$/);
  return m ? { name: m[1].trim().replace(/^"|"$/g, ''), email: m[2].trim() } : { name: 'Samanvayam Khel Utsav', email: from.trim() };
}

// Brevo transactional API: one call per email, a few in parallel
async function sendViaBrevo(mails: Mail[], key: string): Promise<SendResult[]> {
  const sender = parseFrom(EMAIL_FROM);
  const results: SendResult[] = new Array(mails.length);
  const send = async (i: number) => {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender, to: [{ email: mails[i].to }], subject: mails[i].subject, htmlContent: mails[i].html }),
      });
      if (res.ok) results[i] = { ok: true };
      else {
        const body = await res.text();
        console.error('Brevo rejected an email:', res.status, body);
        results[i] = { ok: false, error: `Brevo ${res.status}: ${body.slice(0, 200)}` };
      }
    } catch (err) {
      results[i] = { ok: false, error: err instanceof Error ? err.message : 'Send failed' };
    }
  };
  for (let i = 0; i < mails.length; i += 8) {
    await Promise.all(mails.slice(i, i + 8).map((_, j) => send(i + j)));
  }
  return results;
}

async function sendViaResend(mails: Mail[], key: string): Promise<SendResult[]> {
  const resend = new Resend(key);
  const results: SendResult[] = [];
  for (let i = 0; i < mails.length; i += 100) {
    const chunk = mails.slice(i, i + 100);
    try {
      const { error } = await resend.batch.send(
        chunk.map((m) => ({ from: EMAIL_FROM, to: m.to, subject: m.subject, html: m.html })),
      );
      const outcome: SendResult = error ? { ok: false, error: error.message } : { ok: true };
      if (error) console.error('Resend rejected a batch:', error);
      chunk.forEach(() => results.push(outcome));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send failed';
      console.error('Email batch failed:', err);
      chunk.forEach(() => results.push({ ok: false, error: message }));
    }
  }
  return results;
}

// Brevo is used when BREVO_API_KEY is set, otherwise Resend. Every outcome is recorded in email_log.
export async function sendMails(mails: Mail[]): Promise<SendResult[]> {
  if (mails.length === 0) return [];
  const brevoKey = process.env.BREVO_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  let results: SendResult[];
  if (brevoKey) results = await sendViaBrevo(mails, brevoKey);
  else if (resendKey && resendKey !== 're_your_api_key_here') results = await sendViaResend(mails, resendKey);
  else results = mails.map(() => ({ ok: false, error: 'Email is not configured' }));
  await record(mails, results);
  return results;
}

export async function sendMail(mail: Mail): Promise<SendResult> {
  return (await sendMails([mail]))[0];
}
