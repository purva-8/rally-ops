import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventOrganizer } from '@/lib/organizer';
import { insertMatches } from '@/lib/matchRows';
import { logMatch, scoreText, snapshot, vs, type Snapshot } from '@/lib/matchLog';
import { standing } from '@/lib/quickMatch';

const MATCH_COLUMNS = ['round', 'position', 'label', 'player1_id', 'player1_name', 'player2_id', 'player2_name', 'court_id',
  'referee_id', 'referee_name', 'status', 'winner_id', 'winner_name', 'scheduled_at', 'completed_at'];

async function organizer(tournamentId: string | null | undefined) {
  if (!tournamentId) return { error: NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 }) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: t } = await admin.from('tournaments').select('created_by').eq('id', tournamentId).single();
  if (!t || !(await isEventOrganizer(admin, tournamentId, user.id, t.created_by))) {
    return { error: NextResponse.json({ error: 'Only organizers can see the history' }, { status: 403 }) };
  }
  return { admin, userId: user.id };
}

// The latest changes to matches (newest first), for the Score desk's History.
export async function GET(req: NextRequest) {
  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
  const a = await organizer(tournamentId);
  if (a.error) return a.error;
  const { data, error } = await a.admin!.from('match_log').select('id, match_id, category, action, summary, before, created_at')
    .eq('tournament_id', tournamentId).order('created_at', { ascending: false }).limit(150);
  if (error) return NextResponse.json({ entries: [], ready: false });
  return NextResponse.json({
    ready: true,
    entries: (data ?? []).sort((x, y) => y.created_at.localeCompare(x.created_at)).map((e) => ({
      id: e.id, matchId: e.match_id, category: e.category, action: e.action, summary: e.summary, at: e.created_at,
      restorable: !!e.before || e.action === 'create',
    })),
  });
}

// Put a match back the way it was before one logged change: a score or undone result comes back, a taken-back or
// deleted match is made again (same id, same scores), a match made by mistake is removed. The restore is logged too,
// so it can itself be restored. Body: { tournamentId, logId }.
export async function POST(req: NextRequest) {
  const { tournamentId, logId } = (await req.json().catch(() => ({}))) as { tournamentId?: string; logId?: number | string };
  const a = await organizer(tournamentId);
  if (a.error) return a.error;
  const admin = a.admin!;
  if (logId === undefined || logId === null || logId === '') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: e } = await admin.from('match_log').select('*').eq('id', logId).maybeSingle();
  if (!e || e.tournament_id !== tournamentId || !e.match_id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const target = e.before as Snapshot | null;
  const current = await snapshot(admin, e.match_id);
  const log = (summary: string, after: Snapshot | null) => logMatch(admin, {
    tournamentId: tournamentId!, matchId: e.match_id, category: e.category, action: 'restore', summary, before: current, after, by: a.userId,
  });

  // It was made by this change: restoring means taking it away again, if nobody has scored it since
  if (!target) {
    if (!current) return NextResponse.json({ ok: true, message: 'Already gone' });
    if (current.match.status !== 'upcoming' || current.sets.length) return NextResponse.json({ error: `${vs(current.match)} has a score now. Undo the result first.` }, { status: 409 });
    await admin.from('matches').delete().eq('id', e.match_id);
    await log(`${vs(current.match)}: removed again (restore)`, null);
    return NextResponse.json({ ok: true, message: `Removed ${vs(current.match)}` });
  }

  const { data: cat } = await admin.from('matches').select('*').eq('tournament_id', tournamentId).eq('category', target.match.category);
  const others = (cat ?? []).filter((m) => m.id !== e.match_id);
  // Someone who now has a later match on the strength of the current result can't lose that result underneath it
  if (current?.match.status === 'completed' && current.match.winner_name && current.match.winner_name !== target.match.winner_name) {
    const later = others.find((m) => m.round > current.match.round && (m.player1_name === current.match.winner_name || m.player2_name === current.match.winner_name));
    if (later) return NextResponse.json({ error: `${current.match.winner_name} already has a later match (${vs(later)}). Take that back or undo it first.` }, { status: 409 });
  }
  // A match coming back must not put someone in two matches at once
  if (!current) {
    for (const n of [target.match.player1_name, target.match.player2_name].filter(Boolean)) {
      if (standing(n, others).playing) return NextResponse.json({ error: `${n} is in another match now. Take that back first.` }, { status: 409 });
    }
  }

  const values: Record<string, unknown> = {};
  for (const c of MATCH_COLUMNS) if (target.match[c] !== undefined) values[c] = target.match[c];
  if (current) {
    const { error } = await admin.from('matches').update(values).eq('id', e.match_id);
    if (error) return NextResponse.json({ error: 'Could not restore the match' }, { status: 500 });
  } else {
    const row: Record<string, unknown> = { id: e.match_id, tournament_id: tournamentId, category: target.match.category, created_at: target.match.created_at, ...values };
    let res = await insertMatches(admin, [row], 'id');
    if (res.error?.code === '23505') {
      // its old slot in the round was taken in the meantime: next free one
      const used = others.filter((m) => m.round === row.round).map((m) => m.position ?? -1);
      res = await insertMatches(admin, [{ ...row, position: Math.max(-1, ...used) + 1 }], 'id');
    }
    if (res.error) { console.error('history restore insert failed', res.error); return NextResponse.json({ error: 'Could not restore the match' }, { status: 500 }); }
  }
  // Scores: the old ones in first, then the current ones out, so a failure never leaves the match with none
  const oldIds = (current?.sets ?? []).map((x) => x.id);
  if (target.sets.length) {
    const { error } = await admin.from('match_sets').insert(target.sets.map((x) => ({
      match_id: e.match_id, set_number: x.set_number, player1_score: x.player1_score, player2_score: x.player2_score,
    })));
    if (error) return NextResponse.json({ error: 'The match is back, but its scores could not be restored. Try again.' }, { status: 500 });
  }
  if (oldIds.length) await admin.from('match_sets').delete().in('id', oldIds);

  const after = await snapshot(admin, e.match_id);
  const what = `${vs(after?.match)}: ${after?.match.status === 'completed' ? `${after.match.winner_name} won ` : ''}${scoreText(after?.sets) || 'no score'}`;
  await log(`${what} (restored)`, after);
  return NextResponse.json({ ok: true, message: `Restored ${what}` });
}
