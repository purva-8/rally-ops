import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const tournamentId = searchParams.get('tournamentId');

  if (!tournamentId) {
    return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tournament_staff')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ staff: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { tournamentId, email, name, courtId, role } = body;

  if (!tournamentId || !email?.trim() || !name?.trim()) {
    return NextResponse.json({ error: 'Missing tournamentId, email, or name' }, { status: 400 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: tournament } = await supabase.from('tournaments').select('name, created_by').eq('id', tournamentId).single();
  if (!tournament || tournament.created_by !== user.id) {
    return NextResponse.json({ error: 'Not authorized to invite staff for this tournament' }, { status: 403 });
  }

  const { data: staffRow, error } = await supabase
    .from('tournament_staff')
    .insert({
      tournament_id: tournamentId,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role: role === 'admin' ? 'admin' : 'coach',
      court_id: courtId || null,
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const inviteUrl = `${req.nextUrl.origin}/join-staff?tournamentId=${tournamentId}&email=${encodeURIComponent(staffRow.email)}`;
    try {
      await resend.emails.send({
        from: 'RallyOps <onboarding@resend.dev>',
        to: staffRow.email,
        subject: `You've been invited to coach ${tournament.name}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h2 style="color:#111827;">You're invited to coach ${tournament.name}</h2>
            <p style="color:#57534e;font-size:15px;">You've been added as a coach on RallyOps. Sign in or create a free account with this email to start scoring matches.</p>
            <a href="${inviteUrl}" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">Accept Invite</a>
          </div>
        `,
      });
    } catch (err) {
      console.error('Failed to send invite email:', err);
    }
  }

  return NextResponse.json({ staff: staffRow });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get('id');

  if (!staffId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const { error } = await supabase.from('tournament_staff').delete().eq('id', staffId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
