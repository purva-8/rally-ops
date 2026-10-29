import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { matchResult, impossibleGame, validSets, winnerSide } from '@/lib/bracket';
import { toClientMatches } from '@/lib/matchRows';
import { isEventOrganizer } from '@/lib/organizer';
import { logMatch, scoreText, snapshot, vs } from '@/lib/matchLog';

// Saves a match's court, referee, sets and status. Only organizers and co-organizers may call it: scores
// come in on paper and are typed in on the admin Score desk. The winner is worked out here from the sets, never taken
// from the browser. Next matches are not drawn here: they are made on the spot as players arrive (Match maker).
// Organizers may also save a score that isn't a standard 21-point result (`override`: whoever won more games wins)
// and correct a result after the winner has a later match, as long as that match hasn't started; the new winner
// then takes the old winner's place there.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json().catch(() => ({}));
  const { matchId, sets, courtId, refereeId, refereeName, override, expected, force } = body;
  let { status } = body;

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
    if (!(await isEventOrganizer(admin, match.tournament_id, user.id, t?.created_by))) {
      return NextResponse.json({ error: 'Only organizers can enter scores' }, { status: 403 });
    }

    const isBye = !match.player2_id && !match.player2_name;
    if (isBye) return NextResponse.json({ error: 'A bye has no score' }, { status: 400 });

    // Two desks on one match: the browser says what it last saw; if someone has changed it since, nothing is
    // overwritten without asking (force)
    const before = await snapshot(admin, matchId);
    if (expected && !force && before) {
      const seen = JSON.stringify((expected.sets ?? []).map((x: { player1Score: number; player2Score: number }) => [x.player1Score, x.player2Score]));
      const now = JSON.stringify(before.sets.map((x) => [x.player1_score, x.player2_score]));
      if (seen !== now || (expected.status && expected.status !== match.status)) {
        // The same save arriving twice (the reply was lost on a weak connection and the desk sent it again):
        // it is already saved, so say so instead of calling it someone else's change
        const sent = JSON.stringify(sets.map((x: { player1Score: number; player2Score: number }) => [x.player1Score, x.player2Score]));
        if (sent === now && (!status || status === match.status)) {
          const { data: all } = await admin.from('matches').select('*').eq('tournament_id', match.tournament_id).eq('category', match.category);
          const [client] = toClientMatches(all ?? [match], before.sets).filter((m) => m.id === matchId);
          return NextResponse.json({ match: client, nextMatches: [], alreadySaved: true });
        }
        return NextResponse.json({
          error: `Someone else saved this match since you opened it: ${match.winner_name && match.status === 'completed' ? `${match.winner_name} won ` : ''}${scoreText(before.sets) || 'no score'}.`,
          conflict: true, current: { status: match.status, sets: before.sets.map((x) => ({ player1Score: x.player1_score, player2Score: x.player2_score })) },
        }, { status: 409 });
      }
    }

    const { data: catMatches } = await admin.from('matches').select('*')
      .eq('tournament_id', match.tournament_id).eq('category', match.category);

    if (match.status === 'completed') {
      if (status && status !== 'completed') return NextResponse.json({ error: 'This match is already finished' }, { status: 409 });
      status = 'completed'; // a changed score on a finished match always re-decides the winner
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
    const bad = override ? -1 : sets.findIndex(impossibleGame);
    if (bad >= 0) return NextResponse.json({ error: `Game ${bad + 1} is not a possible badminton score` }, { status: 400 });
    if (status === 'completed') {
      let side: 1 | 2;
      if (override) {
        const w = winnerSide(sets);
        if (!w) return NextResponse.json({ error: 'Both sides won the same number of games, so there is no winner yet' }, { status: 400 });
        side = w;
      } else {
        const result = matchResult(sets);
        if ('problem' in result) return NextResponse.json({ error: result.problem }, { status: 400 });
        side = result.winner;
      }
      updates.winner_id = side === 1 ? match.player1_id : match.player2_id;
      updates.winner_name = side === 1 ? match.player1_name : match.player2_name;
      if (match.status !== 'completed') updates.completed_at = new Date().toISOString();
    }

    // A corrected winner takes the old winner's place in their later matches in this category, if those haven't
    // started. A bye (an odd winner out in an old drawn bracket) passes the new winner straight on.
    const slotFixes: { id: string; values: Record<string, unknown> }[] = [];
    const winnerChanged = match.status === 'completed' && 'winner_name' in updates
      && ((updates.winner_id ?? null) !== (match.winner_id ?? null) || updates.winner_name !== match.winner_name);
    if (winnerChanged && match.winner_name) {
      const who = { id: updates.winner_id ?? null, name: updates.winner_name };
      const later = (catMatches ?? []).filter((m) => m.id !== matchId && m.round > match.round
        && (m.player1_name === match.winner_name || m.player2_name === match.winner_name));
      for (const m of later) {
        const side = m.player1_name === match.winner_name ? 1 : 2;
        if (!m.player2_id && !m.player2_name) {
          slotFixes.push({ id: m.id, values: { player1_id: who.id, player1_name: who.name, winner_id: who.id, winner_name: who.name } });
          continue;
        }
        const { data: nextSets } = await admin.from('match_sets').select('id').eq('match_id', m.id);
        if (m.status !== 'upcoming' || nextSets?.length) {
          return NextResponse.json({
            error: `${m.player1_name} vs ${m.player2_name} has already started or finished. Correct that match first.`,
          }, { status: 409 });
        }
        slotFixes.push({ id: m.id, values: side === 1 ? { player1_id: who.id, player1_name: who.name } : { player2_id: who.id, player2_name: who.name } });
      }
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

    for (const fix of slotFixes) {
      const was = await snapshot(admin, fix.id);
      const { error } = await admin.from('matches').update(fix.values).eq('id', fix.id);
      if (!error) await logMatch(admin, { tournamentId: match.tournament_id, matchId: fix.id, category: match.category, action: 'players',
        summary: `${vs(was?.match)}: ${updated.winner_name} takes ${match.winner_name}'s place after a corrected result`, before: was, after: await snapshot(admin, fix.id), by: user.id });
      if (error) {
        console.error('next-round slot update failed', error);
        return NextResponse.json({ error: 'Result corrected, but the next-round match still shows the old winner. Try again.' }, { status: 500 });
      }
    }

    let nextMatches: ReturnType<typeof toClientMatches> = [];
    if (slotFixes.length) {
      const { data: all } = await admin.from('matches').select('*')
        .eq('tournament_id', match.tournament_id).eq('category', match.category);
      const fixed = new Set(slotFixes.map((f) => f.id));
      nextMatches = toClientMatches(all ?? [], []).filter((m) => fixed.has(m.id));
    }

    const after = await snapshot(admin, matchId);
    await logMatch(admin, {
      tournamentId: match.tournament_id, matchId, category: match.category, action: 'score', before, after, by: user.id,
      summary: `${vs(match)}: ${after?.match.status === 'completed' ? `${after.match.winner_name} won ` : ''}${scoreText(after?.sets) || 'no score'}${match.status === 'completed' ? ` (was ${match.winner_name} ${scoreText(before?.sets)})` : ''}`,
    });

    const { data: savedSets } = await admin.from('match_sets').select('*').eq('match_id', matchId);
    const rows = (catMatches ?? []).map((m) => (m.id === matchId ? updated : m));
    const [client] = toClientMatches(rows, savedSets ?? []).filter((m) => m.id === matchId);
    return NextResponse.json({ match: client, nextMatches });
  } catch (err) {
    console.error('Error saving match score:', err);
    return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
  }
}
