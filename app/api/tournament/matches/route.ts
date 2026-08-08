import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const tournamentId = searchParams.get('tournamentId');

  if (!tournamentId) {
    return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });
  }

  const { data: matches, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true });

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 });
  }

  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: sets, error: setsError } = matchIds.length
    ? await supabase.from('match_sets').select('*').in('match_id', matchIds).order('set_number', { ascending: true })
    : { data: [], error: null };

  if (setsError) {
    return NextResponse.json({ error: setsError.message }, { status: 500 });
  }

  const result = (matches ?? []).map((m) => ({
    id: m.id,
    category: m.category,
    round: m.round,
    roundName: roundNameFromMatches(matches ?? [], m),
    player1Id: m.player1_id,
    player1Name: m.player1_name,
    player2Id: m.player2_id ?? undefined,
    player2Name: m.player2_name ?? undefined,
    isBye: !m.player2_id,
    courtId: m.court_id ?? undefined,
    refereeId: m.referee_id ?? undefined,
    refereeName: m.referee_name ?? undefined,
    status: m.status,
    sets: (sets ?? [])
      .filter((s) => s.match_id === m.id)
      .map((s) => ({ player1Score: s.player1_score, player2Score: s.player2_score })),
    winnerId: m.winner_id ?? undefined,
    winnerName: m.winner_name ?? undefined,
    scheduledAt: m.scheduled_at ?? undefined,
    completedAt: m.completed_at ?? undefined,
  }));

  return NextResponse.json({ matches: result });
}

function roundNameFromMatches(all: any[], m: any) {
  const totalRounds = all
    .filter((x) => x.category === m.category)
    .reduce((max, x) => Math.max(max, x.round), 0);
  const fromEnd = totalRounds - m.round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinal';
  if (fromEnd === 2) return 'Quarterfinal';
  return `Round ${m.round + 1}`;
}
