import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const FROM_EMAIL = 'RallyOps <onboarding@resend.dev>';

interface ConfirmationPayload {
  to: string;
  playerName: string;
  tournamentName: string;
  category: string;
  registrationCode: string;
  venue: string | null;
  eventDate: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  male_singles:   'Male Singles',
  female_singles: 'Female Singles',
  male_doubles:   'Male Doubles',
  female_doubles: 'Female Doubles',
  spouse_doubles: 'Spouse Doubles',
  boys_u13: 'Boys U13',
  boys_u15: 'Boys U15',
  boys_u18: 'Boys U18',
  girls_u13: 'Girls U13',
  girls_u15: 'Girls U15',
  girls_u18: 'Girls U18',
};

function confirmationEmail(data: ConfirmationPayload) {
  const categoryLabel = CATEGORY_LABELS[data.category] ?? data.category;
  const dateStr = data.eventDate
    ? new Date(data.eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fff7ed;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <tr><td style="background:#ea580c;padding:32px 32px 24px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">📝</div>
          <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:800;">Registration Received</h1>
          <p style="color:#fed7aa;margin:8px 0 0;font-size:15px;">${data.tournamentName}</p>
        </td></tr>

        <tr><td style="padding:32px;">
          <p style="color:#1c1917;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Hi ${data.playerName}, your registration has been submitted and is <strong>pending organizer approval</strong>.
          </p>

          <table width="100%" style="border-collapse:collapse;margin-bottom:20px;">
            <tr><td style="padding:8px 0;color:#78716c;font-size:13px;">Category</td><td style="padding:8px 0;color:#1c1917;font-size:13px;font-weight:600;text-align:right;">${categoryLabel}</td></tr>
            <tr><td style="padding:8px 0;color:#78716c;font-size:13px;">Registration ID</td><td style="padding:8px 0;color:#1c1917;font-size:13px;font-weight:600;text-align:right;">${data.registrationCode}</td></tr>
            ${data.venue ? `<tr><td style="padding:8px 0;color:#78716c;font-size:13px;">Venue</td><td style="padding:8px 0;color:#1c1917;font-size:13px;font-weight:600;text-align:right;">${data.venue}</td></tr>` : ''}
            ${dateStr ? `<tr><td style="padding:8px 0;color:#78716c;font-size:13px;">Date</td><td style="padding:8px 0;color:#1c1917;font-size:13px;font-weight:600;text-align:right;">${dateStr}</td></tr>` : ''}
          </table>

          <p style="color:#78716c;font-size:13px;line-height:1.6;margin:0;">
            You'll get another update as soon as the organizer reviews your entry.
          </p>
        </td></tr>

        <tr><td style="background:#fafaf9;padding:20px 32px;text-align:center;">
          <p style="color:#a8a29e;font-size:12px;margin:0;">RallyOps · Tournament Management</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const data: ConfirmationPayload = await req.json();
    if (!data.to || !data.playerName || !data.tournamentName || !data.category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === 're_your_api_key_here') {
      console.log('Resend API key not configured; skipping registration confirmation email.');
      return NextResponse.json({ skipped: true });
    }

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: `Registration received: ${data.tournamentName}`,
      html: confirmationEmail(data),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to send registration confirmation email:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
