import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';

const FROM_EMAIL = 'RallyOps <onboarding@resend.dev>';

interface ApprovedPayload {
  to?: string;
  playerId?: string;
  playerName: string;
  tournamentName: string;
  category: string;
  registrationCode: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  male_singles:   'Male Singles',
  female_singles: 'Female Singles',
  male_doubles:   'Male Doubles',
  female_doubles: 'Female Doubles',
  spouse_doubles: 'Spouse Doubles',
};

function approvedEmail(data: ApprovedPayload) {
  const categoryLabel = CATEGORY_LABELS[data.category] ?? data.category;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <tr><td style="background:#16a34a;padding:32px 32px 24px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">✅</div>
          <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:800;">You're Confirmed!</h1>
          <p style="color:#bbf7d0;margin:8px 0 0;font-size:15px;">${data.tournamentName}</p>
        </td></tr>

        <tr><td style="padding:32px;">
          <p style="color:#1c1917;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Hi ${data.playerName}, your registration has been <strong>approved</strong> by the organizer. See you on court!
          </p>

          <table width="100%" style="border-collapse:collapse;margin-bottom:20px;">
            <tr><td style="padding:8px 0;color:#78716c;font-size:13px;">Category</td><td style="padding:8px 0;color:#1c1917;font-size:13px;font-weight:600;text-align:right;">${categoryLabel}</td></tr>
            <tr><td style="padding:8px 0;color:#78716c;font-size:13px;">Registration ID</td><td style="padding:8px 0;color:#1c1917;font-size:13px;font-weight:600;text-align:right;">${data.registrationCode}</td></tr>
          </table>
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
    const data: ApprovedPayload = await req.json();
    if ((!data.to && !data.playerId) || !data.playerName || !data.tournamentName || !data.category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let to = data.to;
    if (!to && data.playerId) {
      const admin = createAdminClient();
      const { data: userRes } = await admin.auth.admin.getUserById(data.playerId);
      to = userRes?.user?.email ?? undefined;
    }
    if (!to) {
      return NextResponse.json({ error: 'Could not resolve recipient email' }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === 're_your_api_key_here') {
      console.log('Resend API key not configured; skipping approval email.');
      return NextResponse.json({ skipped: true });
    }

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `You're confirmed — ${data.tournamentName}`,
      html: approvedEmail({ ...data, to }),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to send approval email:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
