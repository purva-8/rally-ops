import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventOrganizer } from '@/lib/organizer';
import { toClientMatches } from '@/lib/matchRows';

// Organizers undo a match's result (or its score so far): it goes back to "to be played" with no games.
// Later rounds of the category were drawn from finished results, so if none of their matches has started
// they are removed and drawn again when the round is finished again; if one has started, that one must be
// undone first. Body: { matchId }.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { matchId } = (await req.json().catch(() => ({}))) as { matchId?: string };
  if (!matchId) return NextResponse.json({ error: 'Missing match' }, { status: 400 });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: match } = await admin.from('matches').select('*').eq('id', matchId).maybeSingle();
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    const { data: t } = await admin.from('tournaments').select('created_by').eq('id', match.tournament_id).single();
    if (!(await isEventOrganizer(admin, match.tournament_id, user.id, t?.created_by))) {
      return NextResponse.json({ error: 'Only organizers can undo a result' }, { status: 403 });
    }
    if (!match.player2_id && !match.player2_name) return NextResponse.json({ error: 'A bye has no result to undo' }, { status: 400 });

    const { data: catMatches } = await admin.from('matches').select('*')
      .eq('tournament_id', match.tournament_id).eq('category', match.category);
    const later = (catMatches ?? []).filter((m) => m.round > match.round);
    const laterIds = later.map((m) => m.id);
    const { data: laterSets } = laterIds.length ? await admin.from('match_sets').select('match_id').in('match_id', laterIds) : { data: [] };
    const scored = new Set((laterSets ?? []).map((s) => s.match_id));
    const started = later.find((m) => m.status !== 'upcoming' || scored.has(m.id));
    if (started) {
      return NextResponse.json({
        error: `${started.player1_name} vs ${started.player2_name ?? 'bye'} in a later round has already started or finished. Undo that match first.`,
      }, { status: 409 });
    }

    if (laterIds.length) {
      const { error } = await admin.from('matches').delete().in('id', laterIds);
      if (error) {
        console.error('later rounds delete failed', error);
        return NextResponse.json({ error: 'Could not remove the later rounds' }, { status: 500 });
      }
    }
    await admin.from('match_sets').delete().eq('match_id', matchId);
    const { data: updated, error } = await admin.from('matches')
      .update({ status: 'upcoming', winner_id: null, winner_name: null, completed_at: null })
      .eq('id', matchId).select('*').single();
    if (error) {
      console.error('match reset failed', error);
      return NextResponse.json({ error: 'Could not undo the result' }, { status: 500 });
    }

    const rows = (catMatches ?? []).filter((m) => !laterIds.includes(m.id)).map((m) => (m.id === matchId ? updated : m));
    const [client] = toClientMatches(rows, []).filter((m) => m.id === matchId);
    return NextResponse.json({ match: client, removedIds: laterIds });
  } catch (err) {
    console.error('Error undoing result:', err);
    return NextResponse.json({ error: 'Failed to undo the result' }, { status: 500 });
  }
}
