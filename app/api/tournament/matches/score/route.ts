import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { bwfResult, impossibleGame, nextRoundFor, validSets } from '@/lib/bracket';
import { insertMatches, toClientMatches } from '@/lib/matchRows';

// Saves a match's court, referee, sets and status. Organizers, co-organizers and the event's active
// coaches may call it. The winner is worked out here from the sets, never taken from the browser, and
// when the last match of a round finishes the next round is created here so every device sees it.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json().catch(() => ({}));
  const { matchId, sets, status, courtId, refereeId, refereeName } = body;

  if (!matchId || !validSets(sets)) {
    return NextResponse.json({ error: 'Missing match or invalid scores' }, { status: 400 });
  }
  if (status && !['upcoming', 'in_progress', 'completed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: match } = await admin.from('matches').select('*').eq('id', matchId).maybeSingle();
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const { data: t } = await admin.from('tournaments').select('created_by').eq('id', match.tournament_id).single();
    let allowed = t?.created_by === user.id;
    if (!allowed) {
      const { data: staff } = await admin.from('tournament_staff').select('id')
        .eq('tournament_id', match.tournament_id).eq('user_id', user.id).eq('status', 'active').limit(1);
      allowed = !!staff?.length;
    }
    if (!allowed) return NextResponse.json({ error: 'Not authorized to score this match' }, { status: 403 });

    const isBye = !match.player2_id && !match.player2_name;
    if (isBye) return NextResponse.json({ error: 'A bye has no score' }, { status: 400 });

    const { data: catMatches } = await admin.from('matches').select('*')
      .eq('tournament_id', match.tournament_id).eq('category', match.category);
    const nextRoundExists = (catMatches ?? []).some((m) => m.round === match.round + 1);

    if (match.status === 'completed') {
      // A finished result can be corrected only while the next round has not been drawn from it
      if (nextRoundExists) return NextResponse.json({ error: 'The next round already uses this result, so it cannot be changed here' }, { status: 409 });
      if (status && status !== 'completed') return NextResponse.json({ error: 'This match is already finished' }, { status: 409 });
    }

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (courtId) updates.court_id = courtId;
    if (refereeName) updates.referee_name = refereeName;
    if (refereeId) {
      // The admin screens send a tournament_staff id; the column points at a player profile
      const { data: st } = await admin.from('tournament_staff').select('user_id')
        .eq('id', refereeId).eq('tournament_id', match.tournament_id).maybeSingle();
      let profileId: string | null = null;
      if (st?.user_id) {
        const { data: p } = await admin.from('player_profiles').select('id').eq('auth_user_id', st.user_id).maybeSingle();
        profileId = p?.id ?? null;
      } else if (!st) {
        const { data: p } = await admin.from('player_profiles').select('id').eq('id', refereeId).maybeSingle();
        profileId = p?.id ?? null;
      }
      updates.referee_id = profileId;
    }
    const bad = sets.findIndex(impossibleGame);
    if (bad >= 0) return NextResponse.json({ error: `Game ${bad + 1} is not a possible badminton score` }, { status: 400 });
    if (status === 'completed') {
      const result = bwfResult(sets);
      if ('problem' in result) return NextResponse.json({ error: result.problem }, { status: 400 });
      const side = result.winner;
      updates.winner_id = side === 1 ? match.player1_id : match.player2_id;
      updates.winner_name = side === 1 ? match.player1_name : match.player2_name;
      if (match.status !== 'completed') updates.completed_at = new Date().toISOString();
    }

    // Replace the sets: add the new rows first, then remove the old ones, so a failure never leaves the match empty
    const { data: oldSets } = await admin.from('match_sets').select('id').eq('match_id', matchId);
    if (sets.length > 0) {
      const { error: setError } = await admin.from('match_sets').insert(sets.map((s, i) => ({
        match_id: matchId, set_number: i + 1, player1_score: s.player1Score, player2_score: s.player2Score,
      })));
      if (setError) {
        console.error('match_sets insert failed', setError);
        return NextResponse.json({ error: 'Could not save the scores' }, { status: 500 });
      }
    }
    const oldIds = (oldSets ?? []).map((s) => s.id);
    if (oldIds.length) await admin.from('match_sets').delete().in('id', oldIds);

    let updated = match;
    if (Object.keys(updates).length) {
      const { data, error: matchError } = await admin.from('matches').update(updates).eq('id', matchId).select('*').single();
      if (matchError) {
        console.error('match update failed', matchError);
        return NextResponse.json({ error: 'Could not save the match' }, { status: 500 });
      }
      updated = data;
    }

    let nextMatches: ReturnType<typeof toClientMatches> = [];
    if (updated.status === 'completed') {
      const fresh = (catMatches ?? []).map((m) => (m.id === matchId ? updated : m));
      const pairs = nextRoundFor(fresh, match.round);
      if (pairs) {
        const { error } = await insertMatches(admin, pairs.map((p) => ({
          tournament_id: match.tournament_id,
          category: match.category,
          round: match.round + 1,
          position: p.position,
          player1_id: p.player1Id,
          player1_name: p.player1Name,
          player2_id: p.player2Id,
          player2_name: p.player2Name,
          status: 'upcoming',
        })), 'id');
        // 23505: another device finishing the same round at the same moment already created it
        if (error && error.code !== '23505') {
          console.error('next round insert failed', error);
          return NextResponse.json({ error: 'Result saved, but the next round could not be created. Reload and try again.' }, { status: 500 });
        }
        const { data: all } = await admin.from('matches').select('*')
          .eq('tournament_id', match.tournament_id).eq('category', match.category);
        nextMatches = toClientMatches(all ?? [], []).filter((m) => m.round === match.round + 1);
      }
    }

    const { data: savedSets } = await admin.from('match_sets').select('*').eq('match_id', matchId);
    const rows = (catMatches ?? []).map((m) => (m.id === matchId ? updated : m));
    const [client] = toClientMatches(rows, savedSets ?? []).filter((m) => m.id === matchId);
    return NextResponse.json({ match: client, nextMatches });
  } catch (err) {
    console.error('Error saving match score:', err);
    return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
  }
}
