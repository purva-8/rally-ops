import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toClientMatches } from '@/lib/matchRows';

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
    return NextResponse.json({ error: 'Could not load matches' }, { status: 500 });
  }

  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: sets, error: setsError } = matchIds.length
    ? await supabase.from('match_sets').select('*').in('match_id', matchIds).order('set_number', { ascending: true })
    : { data: [], error: null };

  if (setsError) {
    return NextResponse.json({ error: 'Could not load scores' }, { status: 500 });
  }

  const result = toClientMatches(matches ?? [], sets ?? []);

  return NextResponse.json({ matches: result });
}
