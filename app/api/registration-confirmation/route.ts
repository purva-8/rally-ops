import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendMail } from '@/lib/email';
import { registrationEmail } from '@/lib/emailTemplates';

interface Payload {
  playerName: string;
  tournamentId?: string;
  tournamentName: string;
  registrationCode: string;
  venue: string | null;
  eventDate: string | null;
  entries: { label: string; partner?: string | null; fee: number }[];
}

// One email listing every category registered in this submission.
// The recipient is always the signed-in user's own address, never taken from the request.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data: Payload = await req.json();
    if (!data.playerName || !data.tournamentName || !Array.isArray(data.entries) || data.entries.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await sendMail({
      to: user.email,
      kind: 'registration',
      tournamentId: data.tournamentId ?? null,
      subject: `You've successfully registered: ${data.tournamentName}`,
      html: registrationEmail({
        playerName: data.playerName,
        tournamentName: data.tournamentName,
        registrationRef: data.registrationCode,
        venue: data.venue,
        eventDate: data.eventDate,
        entries: data.entries,
      }),
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to send registration confirmation email:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
