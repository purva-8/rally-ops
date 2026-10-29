import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventOrganizer } from '@/lib/organizer';
import { toClientMatches } from '@/lib/matchRows';
import { logMatch, snapshot, vs } from '@/lib/matchLog';

type Side = { id?: string | null; name?: string };

// Organizers change who plays in a match that hasn't started (a substitute, a draw mistake).
// Body: { matchId, player1: { id?, name }, player2: { id?, name } }. Ids that aren't player profiles
// (entries added by hand) are stored by name only, the same as when the draw was made.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { matchId, player1, player2 } = (await req.json().catch(() => ({}))) as { matchId?: string; player1?: Side; player2?: Side };
  const clean = (s?: Side) => (typeof s?.name === 'string' ? s.name.trim().slice(0, 120) : '');
  if (!matchId || !clean(player1) || !clean(player2)) {
    return NextResponse.json({ error: 'Both players need a name' }, { status: 400 });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: match } = await admin.from('matches').select('*').eq('id', matchId).maybeSingle();
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    const { data: t } = await admin.from('tournaments').select('created_by').eq('id', match.tournament_id).single();
    if (!(await isEventOrganizer(admin, match.tournament_id, user.id, t?.created_by))) {
      return NextResponse.json({ error: 'Only organizers can change the players' }, { status: 403 });
    }

    if (!match.player2_id && !match.player2_name) return NextResponse.json({ error: 'A bye has no opponent to change' }, { status: 400 });
    const { data: sets } = await admin.from('match_sets').select('id').eq('match_id', matchId);
    if (match.status !== 'upcoming' || sets?.length) {
      return NextResponse.json({ error: 'This match has already started, so its players can no longer be changed' }, { status: 409 });
    }

    const ids = [player1?.id, player2?.id].filter((x): x is string => typeof x === 'string' && !!x);
    const { data: known } = ids.length ? await admin.from('player_profiles').select('id').in('id', ids) : { data: [] };
    const profileIds = new Set((known ?? []).map((p: { id: string }) => p.id));
    const pid = (s?: Side) => (s?.id && profileIds.has(s.id) ? s.id : null);

    const before = await snapshot(admin, matchId);
    const { data: updated, error } = await admin.from('matches').update({
      player1_id: pid(player1), player1_name: clean(player1),
      player2_id: pid(player2), player2_name: clean(player2),
    }).eq('id', matchId).select('*').single();
    if (error || !updated) {
      console.error('match players update failed', error);
      return NextResponse.json({ error: 'Could not save the players' }, { status: 500 });
    }

    await logMatch(admin, { tournamentId: match.tournament_id, matchId, category: match.category, action: 'players', by: user.id,
      summary: `${vs(match)} changed to ${vs(updated)}`, before, after: { match: updated, sets: [] } });
    const { data: all } = await admin.from('matches').select('*').eq('tournament_id', match.tournament_id).eq('category', match.category);
    const rows = (all ?? []).map((m) => (m.id === matchId ? updated : m));
    const [client] = toClientMatches(rows, []).filter((m) => m.id === matchId);
    return NextResponse.json({ match: client });
  } catch (err) {
    console.error('Error changing match players:', err);
    return NextResponse.json({ error: 'Failed to change the players' }, { status: 500 });
  }
}
