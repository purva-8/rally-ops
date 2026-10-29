import { latestSets } from './matchRows';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped Supabase rows and client, same as the routes
type Row = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

// A match and its scores at one moment
export type Snapshot = { match: Row; sets: Row[] };

export async function snapshot(admin: Db, matchId: string): Promise<Snapshot | null> {
  const [{ data: match }, { data: sets }] = await Promise.all([
    admin.from('matches').select('*').eq('id', matchId).maybeSingle(),
    admin.from('match_sets').select('*').eq('match_id', matchId),
  ]);
  return match ? { match, sets: latestSets(sets ?? [], matchId) } : null;
}

export const scoreText = (sets: Row[] | undefined) =>
  (sets ?? []).map((s) => `${s.player1_score}-${s.player2_score}`).join(', ');
export const vs = (m: Row | undefined) => (m ? `${m.player1_name} vs ${m.player2_name ?? 'bye'}` : 'a match');

// Records one change in match_log (supabase/match_log.sql). Never fails the request it belongs to: a missing
// table or a hiccup only means this change has no history entry.
export async function logMatch(admin: Db, e: {
  tournamentId: string; matchId?: string | null; category?: string | null; action: string; summary: string;
  before?: Snapshot | null; after?: Snapshot | null; by?: string | null;
}) {
  try {
    const { error } = await admin.from('match_log').insert({
      tournament_id: e.tournamentId, match_id: e.matchId ?? null, category: e.category ?? null, action: e.action,
      summary: e.summary.slice(0, 300), before: e.before ?? null, after: e.after ?? null, by_user: e.by ?? null,
    });
    if (error) console.error('match_log insert failed', error.message);
  } catch (err) {
    console.error('match_log insert failed', err);
  }
}
