import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { matchId, sets, status, winnerId, winnerName, courtId, refereeId, refereeName } = body;

  if (!matchId || !Array.isArray(sets)) {
    return NextResponse.json({ error: 'Missing matchId or sets' }, { status: 400 });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete existing sets for this match, then re-insert (simplest sync approach)
    await supabase.from('match_sets').delete().eq('match_id', matchId);

    const setInserts = sets.map((s: any, i: number) => ({
      match_id: matchId,
      set_number: i + 1,
      player1_score: s.player1Score,
      player2_score: s.player2Score,
    }));

    if (setInserts.length > 0) {
      const { error: setError } = await supabase.from('match_sets').insert(setInserts);
      if (setError) {
        return NextResponse.json({ error: setError.message }, { status: 500 });
      }
    }

    // Update match record
    const updates: any = {};
    if (status) updates.status = status;
    if (winnerId) updates.winner_id = winnerId;
    if (winnerName) updates.winner_name = winnerName;
    if (courtId) updates.court_id = courtId;
    if (refereeId) updates.referee_id = refereeId;
    if (refereeName) updates.referee_name = refereeName;
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    const { data: updatedMatch, error: matchError } = await supabase
      .from('matches')
      .update(updates)
      .eq('id', matchId)
      .select()
      .single();

    if (matchError) {
      return NextResponse.json({ error: matchError.message }, { status: 500 });
    }

    return NextResponse.json({ match: updatedMatch });
  } catch (err) {
    console.error('Error saving match score:', err);
    return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
  }
}
