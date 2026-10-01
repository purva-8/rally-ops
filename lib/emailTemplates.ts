import { categoryLabel } from '@/lib/categories';
import { formatDate } from '@/lib/format';

export const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const qatarTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Qatar', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});
export const qatarDateTime = (d: string | null | undefined) => (d ? qatarTime.format(new Date(d)).replace(',', '') : '');

function layout(opts: { banner: string; emoji: string; title: string; subtitle: string; body: string }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fff7ed;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;padding:32px 16px;"><tr><td align="center">
<table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:${opts.banner};padding:32px 32px 24px;text-align:center;">
<div style="font-size:44px;margin-bottom:8px;">${opts.emoji}</div>
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:800;">${esc(opts.title)}</h1>
<p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:15px;">${esc(opts.subtitle)}</p>
</td></tr>
<tr><td style="padding:28px 32px;color:#1c1917;font-size:15px;line-height:1.6;">${opts.body}</td></tr>
<tr><td style="background:#fafaf9;padding:18px 32px;text-align:center;">
<p style="color:#78716c;font-size:13px;margin:0 0 8px;">Questions? Contact the Game Coordinator, <strong>Sanjay Vaidya</strong>, on <strong>+974 6642 2213</strong>.</p>
<p style="color:#a8a29e;font-size:12px;margin:0;">Samanvayam Khel Utsav · powered by RallyOps</p>
</td></tr></table></td></tr></table></body></html>`;
}

const row = (left: string, right: string, sub?: string) =>
  `<tr><td style="padding:10px 0;border-bottom:1px solid #f5f5f4;font-size:14px;color:#1c1917;">${left}${sub ? `<div style="font-size:12px;color:#78716c;margin-top:2px;">${sub}</div>` : ''}</td><td style="padding:10px 0;border-bottom:1px solid #f5f5f4;font-size:14px;font-weight:700;text-align:right;color:#1c1917;white-space:nowrap;">${right}</td></tr>`;

// 1. Registration received: every category in one email
export function registrationEmail(d: {
  playerName: string; tournamentName: string; registrationRef: string; venue?: string | null; eventDate?: string | null;
  entries: { label: string; partner?: string | null; fee: number }[];
}) {
  const total = d.entries.reduce((s, e) => s + e.fee, 0);
  return layout({
    banner: '#ea580c', emoji: '🏸', title: "You've successfully registered", subtitle: d.tournamentName,
    body: `
<p style="margin:0 0 16px;">Hi ${esc(d.playerName)}, we have received your registration for the categories below. The organizers will review each entry and email you the decision.</p>
<table width="100%" style="border-collapse:collapse;margin-bottom:16px;">
${d.entries.map((e) => row(esc(e.label), e.fee > 0 ? `QAR ${e.fee}` : 'Free', e.partner ? `with ${esc(e.partner)}` : undefined)).join('')}
${total > 0 ? row('<strong>Total</strong>', `QAR ${total}`) : ''}
</table>
<table width="100%" style="border-collapse:collapse;font-size:13px;color:#57534e;">
<tr><td style="padding:4px 0;">Registration reference (Qatar ID)</td><td style="padding:4px 0;text-align:right;font-weight:600;">${esc(d.registrationRef)}</td></tr>
${d.venue ? `<tr><td style="padding:4px 0;">Venue</td><td style="padding:4px 0;text-align:right;font-weight:600;">${esc(d.venue)}</td></tr>` : ''}
${d.eventDate ? `<tr><td style="padding:4px 0;">Date</td><td style="padding:4px 0;text-align:right;font-weight:600;">${formatDate(d.eventDate)}</td></tr>` : ''}
</table>`,
  });
}

// 2. Decisions: approved and rejected together, with comments
export type Decision = { player: string; category: string; partner?: string | null; status: 'approved' | 'rejected'; comment?: string | null; fee: number };
export function decisionEmail(d: { name: string; tournamentName: string; items: Decision[] }) {
  const approved = d.items.filter((i) => i.status === 'approved');
  const rejected = d.items.filter((i) => i.status === 'rejected');
  const block = (title: string, colour: string, list: Decision[]) => list.length === 0 ? '' : `
<h3 style="margin:22px 0 6px;font-size:15px;color:${colour};">${title}</h3>
<table width="100%" style="border-collapse:collapse;">
${list.map((i) => row(
    `${esc(i.player)}: ${esc(categoryLabel(i.category))}`,
    i.status === 'approved' && i.fee > 0 ? `QAR ${i.fee}` : '',
    [i.partner ? `with ${esc(i.partner)}` : '', i.comment ? `Comment: ${esc(i.comment)}` : ''].filter(Boolean).join(' · ') || undefined,
  )).join('')}
</table>`;
  const dueTotal = approved.reduce((s, i) => s + i.fee, 0);
  return layout({
    banner: rejected.length && !approved.length ? '#57534e' : '#16a34a',
    emoji: rejected.length && !approved.length ? '📋' : '✅',
    title: 'Your entries have been reviewed', subtitle: d.tournamentName,
    body: `
<p style="margin:0;">Hi ${esc(d.name)}, here is the decision on your entries.</p>
${block('Approved', '#16a34a', approved)}
${block('Not approved', '#dc2626', rejected)}
${dueTotal > 0 ? `<p style="margin:20px 0 0;font-size:13px;color:#57534e;">Entry fees for approved entries total <strong>QAR ${dueTotal}</strong>. The organizers will share payment details.</p>` : ''}
`,
  });
}

// 3. Fixtures: who plays whom (finals get their own "let's go" copy)
export type Fixture = { player: string; opponent: string; category: string; round: string; when?: string | null; court?: string | null; isFinal: boolean };
export function fixtureEmail(d: { name: string; tournamentName: string; items: Fixture[] }) {
  const finals = d.items.filter((i) => i.isFinal);
  const hasFinal = finals.length > 0;
  return layout({
    banner: hasFinal ? '#7c3aed' : '#2563eb', emoji: hasFinal ? '🏆' : '📅',
    title: hasFinal ? "It's final time. Let's go!" : 'Your matches are set', subtitle: d.tournamentName,
    body: `
<p style="margin:0 0 16px;">${hasFinal
      ? `Hi ${esc(d.name)}, a final is coming up. Bring your best, warm up well and enjoy it. Whatever happens, getting here is a big deal.`
      : `Hi ${esc(d.name)}, here is who is playing whom.`}</p>
<table width="100%" style="border-collapse:collapse;">
${d.items.map((i) => row(
    `${i.isFinal ? '🏆 ' : ''}${esc(i.player)} vs ${esc(i.opponent)}`,
    esc(i.round),
    [esc(categoryLabel(i.category)), i.when ? qatarDateTime(i.when) : 'time to be announced', i.court ? `Court ${esc(i.court.replace(/^court-/, ''))}` : ''].filter(Boolean).join(' · '),
  )).join('')}
</table>
<p style="margin:18px 0 0;font-size:13px;color:#57534e;">Please report to the desk 10 minutes before your match. Times are Qatar time. Schedules can change, and we will email you if yours does.</p>`,
  });
}

// 4. Results: wins and losses together
export type Result = { player: string; opponent: string; category: string; round: string; won: boolean; score: string; isFinal: boolean };
export function resultEmail(d: { name: string; tournamentName: string; items: Result[] }) {
  const champion = d.items.some((i) => i.isFinal && i.won);
  const wins = d.items.filter((i) => i.won).length;
  return layout({
    banner: champion ? '#ca8a04' : '#0f766e', emoji: champion ? '🥇' : '🏸',
    title: champion ? 'Champion!' : 'Match results', subtitle: d.tournamentName,
    body: `
<p style="margin:0 0 16px;">Hi ${esc(d.name)}, ${champion ? 'congratulations, you won a title! ' : ''}here ${d.items.length === 1 ? 'is the result' : 'are the results'} from the latest matches (${wins} won, ${d.items.length - wins} lost).</p>
<table width="100%" style="border-collapse:collapse;">
${d.items.map((i) => row(
    `${i.won ? '✅' : '❌'} ${esc(i.player)} ${i.won ? 'beat' : 'lost to'} ${esc(i.opponent)}`,
    i.score ? esc(i.score) : '',
    `${esc(categoryLabel(i.category))} · ${esc(i.round)}${i.isFinal ? (i.won ? ' · Champion' : ' · Runner-up') : ''}`,
  )).join('')}
</table>
<p style="margin:18px 0 0;font-size:13px;color:#57534e;">Winners move on to the next round. We will email you the next fixture as soon as it is set.</p>`,
  });
}

// 5. The family bill, receipt style
export type BillLineMail = { person: string; category: string; note: string; amount: number; paid: boolean };
export function billEmail(d: { name: string; tournamentName: string; lines: BillLineMail[]; paymentNote?: string | null }) {
  const due = d.lines.filter((l) => !l.paid).reduce((s, l) => s + l.amount, 0);
  const paid = d.lines.filter((l) => l.paid).reduce((s, l) => s + l.amount, 0);
  const people = Array.from(new Set(d.lines.map((l) => l.person)));
  const sections = people.map((p) => `
<h3 style="margin:20px 0 4px;font-size:14px;color:#ea580c;text-transform:uppercase;letter-spacing:1px;">${esc(p)}</h3>
<table width="100%" style="border-collapse:collapse;">
${d.lines.filter((l) => l.person === p).map((l) => row(esc(l.category), l.paid ? `<span style="color:#16a34a;">Paid</span>` : `QAR ${l.amount}`, l.note ? esc(l.note) : undefined)).join('')}
</table>`).join('');
  return layout({
    banner: '#ea580c', emoji: '🧾', title: 'Your bill', subtitle: d.tournamentName,
    body: `
<p style="margin:0 0 8px;">Hi ${esc(d.name)}, here is the bill for your family's approved entries.</p>
${sections}
<table width="100%" style="border-collapse:collapse;margin-top:18px;border-top:2px dashed #d6d3d1;">
${paid > 0 ? row('Paid so far', `QAR ${paid}`) : ''}
<tr><td style="padding:14px 0 0;font-size:16px;font-weight:800;">Amount due</td><td style="padding:14px 0 0;font-size:20px;font-weight:800;text-align:right;color:#ea580c;">QAR ${due}</td></tr>
</table>
<p style="margin:18px 0 0;font-size:13px;color:#57534e;">${esc(d.paymentNote ?? 'The organizers will share payment details. Please keep this email for your records.')}</p>
<p style="margin:14px 0 0;text-align:center;font-size:14px;">Thanks for playing 🏸</p>`,
  });
}
