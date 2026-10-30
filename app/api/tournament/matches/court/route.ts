import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventOrganizer } from '@/lib/organizer';
import { toClientMatches } from '@/lib/matchRows';
import { logMatch, snapshot, vs } from '@/lib/matchLog';

// The venue's courts for this event
const COURTS = ['6', '7', '8', '9'];

// Organizers set a match's court and say when it has started (the leaderboard then shows it as on court now), or
// take the start back while no score is in. Scores are never touched here. Every change is in the match history.
// Body: { matchId, court?: '6' | '7' | '8' | '9' | null, started?: boolean }.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { matchId, court, started } = (await req.json().catch(() => ({}))) as { matchId?: string; court?: string | null; started?: boolean };
  if (!matchId || (court === undefined && started === undefined)) return NextResponse.json({ error: 'Missing match' }, { status: 400 });
  if (court !== undefined && court !== null && !COURTS.includes(String(court))) {
    return NextResponse.json({ error: `Court must be ${COURTS.join(', ')}` }, { status: 400 });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: match } = await admin.from('matches').select('*').eq('id', matchId).maybeSingle();
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    const { data: t } = await admin.from('tournaments').select('created_by').eq('id', match.tournament_id).single();
    if (!(await isEventOrganizer(admin, match.tournament_id, user.id, t?.created_by))) {
      return NextResponse.json({ error: 'Only organizers can change matches' }, { status: 403 });
    }
    if (!match.player2_id && !match.player2_name) return NextResponse.json({ error: 'A bye is not played' }, { status: 400 });

    const before = await snapshot(admin, matchId);
    const updates: Record<string, unknown> = {};
    const said: string[] = [];
    if (court !== undefined) {
      updates.court_id = court === null ? null : `court-${court}`;
      said.push(court === null ? 'court cleared' : `Court ${court}`);
    }
    if (started === true) {
      if (match.status === 'completed') return NextResponse.json({ error: 'This match is already finished' }, { status: 409 });
      if (match.status === 'upcoming') { updates.status = 'in_progress'; said.push('started'); }
    }
    if (started === false && match.status === 'in_progress') {
      if (before?.sets.length) return NextResponse.json({ error: 'This match has a score already. Use Undo to clear it.' }, { status: 409 });
      updates.status = 'upcoming';
      said.push('not started yet');
    }
    if (!Object.keys(updates).length) return NextResponse.json({ ok: true, unchanged: true });

    const { error } = await admin.from('matches').update(updates).eq('id', matchId);
    if (error) {
      console.error('court/start update failed', error);
      return NextResponse.json({ error: 'Could not save' }, { status: 500 });
    }
    const after = await snapshot(admin, matchId);
    await logMatch(admin, {
      tournamentId: match.tournament_id, matchId, category: match.category, action: 'status' in updates ? 'start' : 'court',
      summary: `${vs(match)}: ${said.join(', ')}`, before, after, by: user.id,
    });

    const { data: catMatches } = await admin.from('matches').select('*').eq('tournament_id', match.tournament_id).eq('category', match.category);
    const [client] = toClientMatches(catMatches ?? [], after?.sets ?? []).filter((m) => m.id === matchId);
    return NextResponse.json({ match: client });
  } catch (err) {
    console.error('Error setting court/start:', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
