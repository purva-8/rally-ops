import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventOrganizer } from '@/lib/organizer';
import { insertMatches, toClientMatches } from '@/lib/matchRows';
import { roundFor, roundName, standing } from '@/lib/quickMatch';
import { logMatch, snapshot, vs } from '@/lib/matchLog';

type Side = { id?: string | null; name?: string };

async function organizer(tournamentId: string | undefined) {
  if (!tournamentId) return { error: NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 }) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: t } = await admin.from('tournaments').select('created_by').eq('id', tournamentId).single();
  if (!t || !(await isEventOrganizer(admin, tournamentId, user.id, t.created_by))) {
    return { error: NextResponse.json({ error: 'Only organizers can make matches' }, { status: 403 }) };
  }
  return { admin, userId: user.id };
}

// Matches made on the spot as players arrive (Score desk → Match maker). Body: { tournamentId, category,
// pairs: [{ player1: { id, name }, player2: { id, name } }], final? }. Each match's round follows how far its
// players have got (lib/quickMatch); it goes straight to the Score desk and the leaderboard.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { tournamentId, category, pairs, final } = body as { tournamentId?: string; category?: string; pairs?: { player1?: Side; player2?: Side }[]; final?: boolean };
  if (!category || !/^[a-z0-9_]{1,40}$/.test(category) || !Array.isArray(pairs) || pairs.length === 0 || pairs.length > 32) {
    return NextResponse.json({ error: 'Pick a category and at least two players' }, { status: 400 });
  }
  if (final && pairs.length !== 1) return NextResponse.json({ error: 'A final is one match' }, { status: 400 });
  const a = await organizer(tournamentId);
  if (a.error) return a.error;
  const admin = a.admin!;

  const name = (s?: Side) => (typeof s?.name === 'string' ? s.name.trim().slice(0, 120) : '');
  const all = pairs.flatMap((p) => [name(p.player1), name(p.player2)]);
  if (all.some((n) => !n)) return NextResponse.json({ error: 'Every match needs two players' }, { status: 400 });
  if (new Set(all).size !== all.length) return NextResponse.json({ error: 'Someone is in two of these matches' }, { status: 400 });

  const { data: existing } = await admin.from('matches').select('*').eq('tournament_id', tournamentId).eq('category', category);
  const rows = existing ?? [];
  for (const n of all) {
    const s = standing(n, rows);
    if (s.playing) return NextResponse.json({ error: `${n} already has a match waiting or on court` }, { status: 409 });
    if (s.out) return NextResponse.json({ error: `${n} has already lost a match in this category` }, { status: 409 });
  }

  // Ids that aren't player profiles (people entered at the desk) are stored by name only
  const ids = Array.from(new Set(pairs.flatMap((p) => [p.player1?.id, p.player2?.id]).filter((x): x is string => typeof x === 'string' && x.length > 0)));
  const { data: known } = ids.length ? await admin.from('player_profiles').select('id').in('id', ids) : { data: [] };
  const profileIds = new Set((known ?? []).map((p: { id: string }) => p.id));
  const pid = (s?: Side) => (s?.id && profileIds.has(s.id) ? s.id : null);

  // Next free slot in each round, so slots never clash with matches already there
  const nextPos = new Map<number, number>();
  for (const m of rows) nextPos.set(m.round, Math.max(nextPos.get(m.round) ?? 0, (m.position ?? -1) + 1));
  const inserts = pairs.map((p) => {
    const round = roundFor(standing(name(p.player1), rows), standing(name(p.player2), rows));
    const position = nextPos.get(round) ?? 0;
    nextPos.set(round, position + 1);
    return {
      tournament_id: tournamentId, category, round, position, label: roundName(round, !!final), status: 'upcoming',
      player1_id: pid(p.player1), player1_name: name(p.player1), player2_id: pid(p.player2), player2_name: name(p.player2),
    };
  });
  let res = await insertMatches(admin, inserts, '*');
  // Before supabase/event_day.sql has been run there is no label column: save without it
  if (res.error && /label/.test(res.error.message ?? '')) res = await insertMatches(admin, inserts.map(({ label: _drop, ...r }) => r), '*');
  if (res.error) {
    console.error('quick match insert failed', res.error);
    return NextResponse.json({ error: res.error.code === '23505' ? 'Someone else just made a match here. Reload and try again.' : 'Could not save the matches' }, { status: 500 });
  }
  for (const m of res.data ?? []) await logMatch(admin, { tournamentId: tournamentId!, matchId: m.id, category, action: 'create', by: a.userId,
    summary: `${vs(m)}: ${m.label ?? 'match'} made`, before: null, after: { match: m, sets: [] } });
  return NextResponse.json({ matches: toClientMatches(res.data ?? [], []) });
}

// Take back a match that hasn't started (rolled by mistake, or someone left). Body: { tournamentId, matchId }.
export async function DELETE(req: NextRequest) {
  const { tournamentId, matchId } = (await req.json().catch(() => ({}))) as { tournamentId?: string; matchId?: string };
  if (!matchId) return NextResponse.json({ error: 'Missing match' }, { status: 400 });
  const a = await organizer(tournamentId);
  if (a.error) return a.error;
  const admin = a.admin!;
  const { data: m } = await admin.from('matches').select('id, tournament_id, status').eq('id', matchId).maybeSingle();
  if (!m || m.tournament_id !== tournamentId) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  const { data: sets } = await admin.from('match_sets').select('id').eq('match_id', matchId);
  if (m.status !== 'upcoming' || sets?.length) return NextResponse.json({ error: 'This match has a score. Undo the result first.' }, { status: 409 });
  const before = await snapshot(admin, matchId);
  const { error } = await admin.from('matches').delete().eq('id', matchId);
  if (error) return NextResponse.json({ error: 'Could not remove the match' }, { status: 500 });
  await logMatch(admin, { tournamentId: tournamentId!, matchId, category: before?.match.category, action: 'delete', by: a.userId,
    summary: `${vs(before?.match)}: taken back`, before, after: null });
  return NextResponse.json({ ok: true });
}
