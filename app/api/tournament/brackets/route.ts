import { isEventOrganizer } from '@/lib/organizer';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { insertMatches, latestSets } from '@/lib/matchRows';
import { logMatch, vs } from '@/lib/matchLog';

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

    if (!tournament || !(await isEventOrganizer(supabase, tournamentId, user.id, tournament.created_by))) {
      return NextResponse.json({ error: 'Not authorized to create brackets for this tournament' }, { status: 403 });
    }

    // Never create a second bracket for a category that already has one (double click, two admins)
    const cats = Array.from(new Set(matches.map((m: { category: string }) => m.category)));
    if (cats.length) {
      const { count } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)
        .in('category', cats);
      if ((count ?? 0) > 0) {
        return NextResponse.json({ error: 'A bracket already exists for this category' }, { status: 409 });
      }
    }

    // Entries added by hand have no player profile; their id is the registration id, which the
    // player columns can't hold, so they are stored by name only
    const ids = Array.from(new Set(matches.flatMap((m: any) => [m.player1Id, m.player2Id]).filter(Boolean)));
    const { data: known } = ids.length
      ? await supabase.from('player_profiles').select('id').in('id', ids)
      : { data: [] };
    const profileIds = new Set((known ?? []).map((p: { id: string }) => p.id));
    const pid = (id: string | null | undefined) => (id && profileIds.has(id) ? id : null);

    // Slot order inside round 1 decides who meets whom later, so it is saved with each match
    const slot = new Map<string, number>();
    const matchInserts = matches.map((m: any) => {
      const position = slot.get(m.category) ?? 0;
      slot.set(m.category, position + 1);
      return {
        tournament_id: tournamentId,
        category: m.category,
        round: m.round,
        position: m.position ?? position,
        player1_id: pid(m.player1Id),
        player1_name: m.player1Name,
        player2_id: pid(m.player2Id),
        player2_name: m.player2Name ?? null,
        status: m.status ?? 'upcoming',
        winner_id: pid(m.winnerId),
        winner_name: m.winnerName ?? null,
        scheduled_at: m.scheduledAt ?? null,
      };
    });

    const { data: insertedMatches, error: matchError } = await insertMatches(supabase, matchInserts,
      'id, category, round, player1_id, player1_name, player2_id, player2_name, status, winner_id, winner_name');

    if (matchError) {
      console.error('bracket insert failed', matchError);
      return NextResponse.json({ error: 'Could not save the bracket' }, { status: 500 });
    }

    return NextResponse.json({ matches: insertedMatches });
  } catch (err) {
    console.error('Error saving brackets:', err);
    return NextResponse.json({ error: 'Failed to save brackets' }, { status: 500 });
  }
}

// Organizers delete a category's whole draw (every round and score) so it can be drawn again.
// Body: { tournamentId, category }. The deleted rows come back in the response so the admin screen can
// offer Undo (see ./restore).
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { tournamentId, category } = (await req.json().catch(() => ({}))) as { tournamentId?: string; category?: string };
  if (!tournamentId || !category) return NextResponse.json({ error: 'Missing tournamentId or category' }, { status: 400 });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: tournament } = await admin.from('tournaments').select('created_by').eq('id', tournamentId).single();
    if (!tournament || !(await isEventOrganizer(admin, tournamentId, user.id, tournament.created_by))) {
      return NextResponse.json({ error: 'Only organizers can delete a draw' }, { status: 403 });
    }

    const { data: rows } = await admin.from('matches').select('*').eq('tournament_id', tournamentId).eq('category', category);
    const ids = (rows ?? []).map((m) => m.id);
    if (!ids.length) return NextResponse.json({ error: 'This category has no draw' }, { status: 404 });
    const { data: sets } = await admin.from('match_sets').select('*').in('match_id', ids);

    // Scores go with their matches (the foreign key cascades); deleting them first keeps that true everywhere
    await admin.from('match_sets').delete().in('match_id', ids);
    const { error } = await admin.from('matches').delete().in('id', ids);
    if (error) {
      console.error('draw delete failed', error);
      return NextResponse.json({ error: 'Could not delete the draw' }, { status: 500 });
    }
    for (const m of rows ?? []) await logMatch(admin, { tournamentId, matchId: m.id, category, action: 'delete', by: user.id,
      summary: `${vs(m)}: removed with the whole ${category} draw`, before: { match: m, sets: latestSets(sets ?? [], m.id) }, after: null });
    return NextResponse.json({ deleted: { matches: rows, sets: sets ?? [] } });
  } catch (err) {
    console.error('Error deleting draw:', err);
    return NextResponse.json({ error: 'Failed to delete the draw' }, { status: 500 });
  }
}
