import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const tournamentId = searchParams.get('tournamentId');

  if (!tournamentId) {
    return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });
  }

  try {
    const { data: regs, error: regError } = await supabase
      .from('registrations')
      .select('id, player_id, tournament_id, category, partner_id, partner_name, emergency_contact, status, created_at, manual_name, manual_email, manual_mobile')
      .eq('tournament_id', tournamentId)
      .eq('status', 'approved');

    if (regError) {
      return NextResponse.json({ error: regError.message }, { status: 500 });
    }

    const playerIds = new Set<string>();
    regs?.forEach(r => {
      if (r.player_id) playerIds.add(r.player_id);
      if (r.partner_id) playerIds.add(r.partner_id);
    });

    const { data: profiles, error: profileError } = await supabase
      .from('player_profiles')
      .select('id, full_name, gender, dob, mobile')
      .in('id', Array.from(playerIds));

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? []);

    const participants = regs?.map((reg: any) => {
      const profile = reg.player_id ? profileMap.get(reg.player_id) : null;
      const partnerProfile = reg.partner_id ? profileMap.get(reg.partner_id) : null;

      return {
        id: reg.player_id ?? reg.id,
        fullName: profile?.full_name ?? reg.manual_name ?? 'Unknown',
        mobile: profile?.mobile ?? reg.manual_mobile ?? '',
        email: reg.manual_email ?? '',
        gender: profile?.gender ?? 'male',
        dob: profile?.dob ?? '',
        emergencyContact: reg.emergency_contact ?? '',
        categories: [reg.category],
        partnerId: reg.partner_id ?? undefined,
        partnerName: partnerProfile?.full_name ?? reg.partner_name ?? undefined,
        registrationId: reg.id,
        registeredAt: reg.created_at,
      };
    }) ?? [];

    return NextResponse.json({ participants });
  } catch (err) {
    console.error('Error loading registrations:', err);
    return NextResponse.json({ error: 'Failed to load registrations' }, { status: 500 });
  }
}
