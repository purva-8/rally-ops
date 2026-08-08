import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { tournamentId, matches } = body;

  if (!tournamentId || !Array.isArray(matches)) {
    return NextResponse.json({ error: 'Missing tournamentId or matches' }, { status: 400 });
  }

  try {
    // Verify user is the tournament organizer
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('created_by')
      .eq('id', tournamentId)
      .single();

    if (!tournament || tournament.created_by !== user.id) {
      return NextResponse.json({ error: 'Not authorized to create brackets for this tournament' }, { status: 403 });
    }

    // Insert matches into DB
    const matchInserts = matches.map((m: any) => ({
      tournament_id: tournamentId,
      category: m.category,
      round: m.round,
      player1_id: m.player1Id,
      player1_name: m.player1Name,
      player2_id: m.player2Id,
      player2_name: m.player2Name,
      status: m.status ?? 'upcoming',
      scheduled_at: m.scheduledAt ?? null,
    }));

    const { data: insertedMatches, error: matchError } = await supabase
      .from('matches')
      .insert(matchInserts)
      .select('id, category, round, player1_id, player1_name, player2_id, player2_name, status');

    if (matchError) {
      return NextResponse.json({ error: matchError.message }, { status: 500 });
    }

    return NextResponse.json({ matches: insertedMatches });
  } catch (err) {
    console.error('Error saving brackets:', err);
    return NextResponse.json({ error: 'Failed to save brackets' }, { status: 500 });
  }
}
