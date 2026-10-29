import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { matchResult, impossibleGame, nextRoundFor, nextSlotOf, validSets, winnerSide } from '@/lib/bracket';
import { insertMatches, toClientMatches } from '@/lib/matchRows';
import { isEventOrganizer } from '@/lib/organizer';

// Saves a match's court, referee, sets and status. Only organizers and co-organizers may call it: scores
// come in on paper and are typed in on the admin Score desk. The winner is worked out here from the sets, never taken from the browser, and
// when the last match of a round finishes the next round is created here so every device sees it.
// Organizers (not coaches) may also save a score that isn't a standard 21-point result (`override`:
// whoever won more games wins) and correct a result after the next round exists, as long as the
// next-round match it feeds hasn't started; the new winner then takes the old winner's place there.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json().catch(() => ({}));
  const { matchId, sets, courtId, refereeId, refereeName, override } = body;
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

    const { data: catMatches } = await admin.from('matches').select('*')
      .eq('tournament_id', match.tournament_id).eq('category', match.category);
    const nextRoundExists = (catMatches ?? []).some((m) => m.round === match.round + 1);

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

    // A corrected winner moves into the next-round match in place of the old one, if that match hasn't started.
    // A bye in between (a round with an odd number of winners) passes the new winner straight on.
    const slotFixes: { id: string; values: Record<string, unknown> }[] = [];
    const winnerChanged = match.status === 'completed' && 'winner_name' in updates
      && ((updates.winner_id ?? null) !== (match.winner_id ?? null) || updates.winner_name !== match.winner_name);
    if (winnerChanged && nextRoundExists) {
      const who = { id: updates.winner_id ?? null, name: updates.winner_name };
      let from: string = matchId;
      for (;;) {
        const slot = nextSlotOf(catMatches ?? [], from);
        if (!slot) {
          if (!slotFixes.length) return NextResponse.json({ error: 'Could not find the next-round match for this result' }, { status: 409 });
          break;
        }
        if (!slot.next.player2_id && !slot.next.player2_name) {
          slotFixes.push({ id: slot.next.id, values: { player1_id: who.id, player1_name: who.name, winner_id: who.id, winner_name: who.name } });
          from = slot.next.id;
          continue;
        }
        const { data: nextSets } = await admin.from('match_sets').select('id').eq('match_id', slot.next.id);
        if (slot.next.status !== 'upcoming' || nextSets?.length) {
          return NextResponse.json({
            error: `${slot.next.player1_name} vs ${slot.next.player2_name} in a later round has already started or finished. Correct that match first.`,
          }, { status: 409 });
        }
        slotFixes.push({
          id: slot.next.id,
          values: slot.side === 1 ? { player1_id: who.id, player1_name: who.name } : { player2_id: who.id, player2_name: who.name },
        });
        break;
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
      const { error } = await admin.from('matches').update(fix.values).eq('id', fix.id);
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
    } else if (updated.status === 'completed') {
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
          player2_name: p.bye ? null : p.player2Name,
          // An odd winner out waits for the next round: a bye, already through
          ...(p.bye
            ? { status: 'completed', winner_id: p.player1Id, winner_name: p.player1Name, completed_at: new Date().toISOString() }
            : { status: 'upcoming' }),
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
