import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventOrganizer } from '@/lib/organizer';
import { insertMatches } from '@/lib/matchRows';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows exactly as the delete returned them
type Row = Record<string, any>;

const MATCH_COLUMNS = ['id', 'round', 'position', 'player1_id', 'player1_name', 'player2_id', 'player2_name', 'court_id',
  'referee_id', 'referee_name', 'status', 'winner_id', 'winner_name', 'scheduled_at', 'completed_at', 'created_at'];

// Undo for "Delete draw": puts back the matches and scores the delete returned, with their old ids.
// Only into an empty category, so it can't double up a draw made in the meantime.
// Body: { tournamentId, category, matches, sets }.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { tournamentId, category, matches, sets } = (await req.json().catch(() => ({}))) as
    { tournamentId?: string; category?: string; matches?: Row[]; sets?: Row[] };
  if (!tournamentId || !category || !Array.isArray(matches) || !matches.length || (sets && !Array.isArray(sets))) {
    return NextResponse.json({ error: 'Nothing to restore' }, { status: 400 });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: tournament } = await admin.from('tournaments').select('created_by').eq('id', tournamentId).single();
    if (!tournament || !(await isEventOrganizer(admin, tournamentId, user.id, tournament.created_by))) {
      return NextResponse.json({ error: 'Only organizers can restore a draw' }, { status: 403 });
    }

    const { data: existing } = await admin.from('matches').select('id').eq('tournament_id', tournamentId).eq('category', category);
    if (existing?.length) return NextResponse.json({ error: 'This category has a new draw now, so the old one can\'t be put back' }, { status: 409 });

    const rows = matches.map((m) => {
      const r: Row = { tournament_id: tournamentId, category };
      for (const c of MATCH_COLUMNS) if (m[c] !== undefined) r[c] = m[c];
      return r;
    });
    const ids = new Set(rows.map((r) => r.id));
    const { error } = await insertMatches(admin, rows, 'id');
    if (error) {
      console.error('draw restore failed', error);
      return NextResponse.json({ error: 'Could not restore the draw' }, { status: 500 });
    }
    const setRows = (sets ?? []).filter((s) => ids.has(s.match_id)).map((s) => ({
      match_id: s.match_id, set_number: s.set_number, player1_score: s.player1_score, player2_score: s.player2_score,
    }));
    if (setRows.length) {
      const { error: setError } = await admin.from('match_sets').insert(setRows);
      if (setError) {
        console.error('draw restore scores failed', setError);
        return NextResponse.json({ error: 'The draw is back, but its scores could not be restored' }, { status: 500 });
      }
    }
    return NextResponse.json({ restored: rows.length });
  } catch (err) {
    console.error('Error restoring draw:', err);
    return NextResponse.json({ error: 'Failed to restore the draw' }, { status: 500 });
  }
}
