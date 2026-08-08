import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const TOURNAMENT_NAME = 'Samanvayam Qatar';
const TOURNAMENT_DATE = 'Wednesday, 15 July 2026';
const VENUE = 'Sports Complex, Main Hall';
const FROM_EMAIL = 'RallyOps <onboarding@resend.dev>';

interface MatchResultPayload {
  category: string;
  round: string;
  court: string;
  sets: { player1Score: number; player2Score: number }[];
  winner: { name: string; email: string };
  loser: { name: string; email: string };
}

function scoreString(sets: { player1Score: number; player2Score: number }[], winnerIsPlayer1: boolean) {
  return sets.map((s) => {
    const w = winnerIsPlayer1 ? s.player1Score : s.player2Score;
    const l = winnerIsPlayer1 ? s.player2Score : s.player1Score;
    return `${w}–${l}`;
  }).join(', ');
}

function winnerEmail(data: MatchResultPayload, scores: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fff7ed;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#ea580c;padding:32px 32px 24px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">🏆</div>
          <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:800;">You Won!</h1>
          <p style="color:#fed7aa;margin:8px 0 0;font-size:15px;">${TOURNAMENT_NAME}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="color:#431407;font-size:17px;margin:0 0 8px;">Congratulations, <strong>${data.winner.name}</strong>! 🎉</p>
          <p style="color:#7c2d12;font-size:15px;margin:0 0 24px;">You advanced in <strong>${data.category}</strong> — ${data.round}.</p>

          <!-- Score card -->
          <table width="100%" style="background:#fff7ed;border:2px solid #fed7aa;border-radius:12px;margin-bottom:24px;">
            <tr>
              <td style="padding:16px;text-align:center;border-right:1px solid #fed7aa;">
                <p style="margin:0;color:#9a3412;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Winner</p>
                <p style="margin:4px 0 0;color:#ea580c;font-size:18px;font-weight:700;">${data.winner.name}</p>
              </td>
              <td style="padding:16px;text-align:center;border-right:1px solid #fed7aa;">
                <p style="margin:0;color:#9a3412;font-size:22px;font-weight:800;">VS</p>
              </td>
              <td style="padding:16px;text-align:center;">
                <p style="margin:0;color:#9a3412;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Opponent</p>
                <p style="margin:4px 0 0;color:#78716c;font-size:18px;font-weight:700;">${data.loser.name}</p>
              </td>
            </tr>
            <tr><td colspan="3" style="padding:12px 16px;border-top:1px solid #fed7aa;text-align:center;">
              <p style="margin:0;color:#9a3412;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Score</p>
              <p style="margin:4px 0 0;color:#431407;font-size:20px;font-weight:700;">${scores}</p>
            </td></tr>
          </table>

          <table width="100%" style="margin-bottom:24px;">
            <tr>
              <td width="50%" style="padding-right:8px;">
                <div style="background:#f5f5f4;border-radius:8px;padding:12px;">
                  <p style="margin:0;color:#78716c;font-size:11px;text-transform:uppercase;">Category</p>
                  <p style="margin:4px 0 0;color:#292524;font-size:14px;font-weight:600;">${data.category}</p>
                </div>
              </td>
              <td width="50%" style="padding-left:8px;">
                <div style="background:#f5f5f4;border-radius:8px;padding:12px;">
                  <p style="margin:0;color:#78716c;font-size:11px;text-transform:uppercase;">Court</p>
                  <p style="margin:4px 0 0;color:#292524;font-size:14px;font-weight:600;">${data.court}</p>
                </div>
              </td>
            </tr>
          </table>

          <p style="color:#7c2d12;font-size:14px;margin:0 0 4px;">Watch for your next match schedule on the live bracket.</p>
          <p style="color:#a8a29e;font-size:13px;margin:0;">${VENUE} · ${TOURNAMENT_DATE}</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#fff7ed;padding:20px 32px;text-align:center;border-top:1px solid #fed7aa;">
          <p style="color:#c2410c;font-size:13px;margin:0;font-weight:600;">${TOURNAMENT_NAME}</p>
          <p style="color:#a8a29e;font-size:12px;margin:4px 0 0;">${VENUE}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function loserEmail(data: MatchResultPayload, scores: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#292524;padding:32px 32px 24px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">🏸</div>
          <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:800;">Match Result</h1>
          <p style="color:#a8a29e;margin:8px 0 0;font-size:15px;">${TOURNAMENT_NAME}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="color:#292524;font-size:17px;margin:0 0 8px;">Hi <strong>${data.loser.name}</strong>,</p>
          <p style="color:#57534e;font-size:15px;margin:0 0 24px;">Thank you for competing in <strong>${data.category}</strong> — ${data.round}. It was a great game!</p>

          <!-- Score card -->
          <table width="100%" style="background:#f5f5f4;border:2px solid #e7e5e4;border-radius:12px;margin-bottom:24px;">
            <tr>
              <td style="padding:16px;text-align:center;border-right:1px solid #e7e5e4;">
                <p style="margin:0;color:#78716c;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Winner</p>
                <p style="margin:4px 0 0;color:#ea580c;font-size:18px;font-weight:700;">${data.winner.name}</p>
              </td>
              <td style="padding:16px;text-align:center;border-right:1px solid #e7e5e4;">
                <p style="margin:0;color:#78716c;font-size:22px;font-weight:800;">VS</p>
              </td>
              <td style="padding:16px;text-align:center;">
                <p style="margin:0;color:#78716c;font-size:12px;text-transform:uppercase;letter-spacing:1px;">You</p>
                <p style="margin:4px 0 0;color:#292524;font-size:18px;font-weight:700;">${data.loser.name}</p>
              </td>
            </tr>
            <tr><td colspan="3" style="padding:12px 16px;border-top:1px solid #e7e5e4;text-align:center;">
              <p style="margin:0;color:#78716c;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Score</p>
              <p style="margin:4px 0 0;color:#292524;font-size:20px;font-weight:700;">${scores}</p>
            </td></tr>
          </table>

          <div style="background:#fff7ed;border-left:4px solid #ea580c;border-radius:0 8px 8px 0;padding:16px;margin-bottom:24px;">
            <p style="margin:0;color:#9a3412;font-size:14px;font-weight:600;">Keep your head up! 💪</p>
            <p style="margin:6px 0 0;color:#c2410c;font-size:13px;">Every match is a learning experience. You played well — see you on the court!</p>
          </div>

          <table width="100%" style="margin-bottom:24px;">
            <tr>
              <td width="50%" style="padding-right:8px;">
                <div style="background:#f5f5f4;border-radius:8px;padding:12px;">
                  <p style="margin:0;color:#78716c;font-size:11px;text-transform:uppercase;">Category</p>
                  <p style="margin:4px 0 0;color:#292524;font-size:14px;font-weight:600;">${data.category}</p>
                </div>
              </td>
              <td width="50%" style="padding-left:8px;">
                <div style="background:#f5f5f4;border-radius:8px;padding:12px;">
                  <p style="margin:0;color:#78716c;font-size:11px;text-transform:uppercase;">Court</p>
                  <p style="margin:4px 0 0;color:#292524;font-size:14px;font-weight:600;">${data.court}</p>
                </div>
              </td>
            </tr>
          </table>

          <p style="color:#a8a29e;font-size:13px;margin:0;">${VENUE} · ${TOURNAMENT_DATE}</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f5f5f4;padding:20px 32px;text-align:center;border-top:1px solid #e7e5e4;">
          <p style="color:#57534e;font-size:13px;margin:0;font-weight:600;">${TOURNAMENT_NAME}</p>
          <p style="color:#a8a29e;font-size:12px;margin:4px 0 0;">${VENUE}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const body: MatchResultPayload = await req.json();
  const { winner, loser, sets } = body;

  // Figure out if winner was player1 by checking first set scores
  // We pass winner/loser already resolved so just show winner-perspective score
  const winnerScores = sets.map((s) => {
    const wScore = Math.max(s.player1Score, s.player2Score);
    const lScore = Math.min(s.player1Score, s.player2Score);
    return `${wScore}–${lScore}`;
  }).join(', ');

  const results = await Promise.allSettled([
    resend.emails.send({
      from: FROM_EMAIL,
      to: winner.email,
      subject: `🏆 You Won! — ${body.category} ${body.round}`,
      html: winnerEmail(body, winnerScores),
    }),
    resend.emails.send({
      from: FROM_EMAIL,
      to: loser.email,
      subject: `Match Result — ${body.category} ${body.round}`,
      html: loserEmail(body, winnerScores),
    }),
  ]);

  const errors = results.filter((r) => r.status === 'rejected');
  if (errors.length > 0) {
    console.error('Email send errors:', errors);
    return NextResponse.json({ ok: false, errors }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
