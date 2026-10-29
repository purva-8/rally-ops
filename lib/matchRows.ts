import { roundLabel, totalRoundsFor, bracketOrder, type BracketMatch } from './bracket';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped Supabase rows, same as the routes
type Row = Record<string, any>;

// Database match rows (plus their sets) in the shape the browser store uses
export function toClientMatches(rows: Row[], sets: Row[]) {
  const round0 = new Map<string, number>();
  for (const m of rows) if (m.round === 0) round0.set(m.category, (round0.get(m.category) ?? 0) + 1);
  return [...rows]
    .sort((a, b) => a.category === b.category ? (a.round - b.round || bracketOrder(a as BracketMatch, b as BracketMatch)) : a.category < b.category ? -1 : 1)
    .map((m) => ({
      id: m.id,
      category: m.category,
      round: m.round,
      position: m.position ?? undefined,
      // Matches made on the spot carry their own name; an old drawn bracket's come from its size
      roundName: m.label ?? roundLabel(m.round, totalRoundsFor(round0.get(m.category) ?? 0)),
      player1Id: m.player1_id,
      player1Name: m.player1_name,
      player2Id: m.player2_id ?? undefined,
      player2Name: m.player2_name ?? undefined,
      isBye: !m.player2_id && !m.player2_name,
      courtId: m.court_id ?? undefined,
      refereeId: m.referee_id ?? undefined,
      refereeName: m.referee_name ?? undefined,
      status: m.status,
      sets: latestSets(sets, m.id).map((s) => ({ player1Score: s.player1_score, player2Score: s.player2_score })),
      winnerId: m.winner_id ?? undefined,
      winnerName: m.winner_name ?? undefined,
      scheduledAt: m.scheduled_at ?? undefined,
      completedAt: m.completed_at ?? undefined,
    }));
}

// Insert match rows; if the position column has not been added to the database yet, retry without it
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts the session or the admin client
export async function insertMatches(db: any, rows: Row[], select: string) {
  let res = await db.from('matches').insert(rows).select(select);
  if (res.error && /position/.test(res.error.message ?? '')) {
    res = await db.from('matches').insert(rows.map(({ position: _drop, ...r }) => r)).select(select);
  }
  return res;
}

// One row per game for a match, newest row winning if an interrupted save ever left two for the same game
export function latestSets<T extends Row>(sets: T[], matchId: string): T[] {
  const byGame = new Map<number, T>();
  for (const s of sets) {
    if (s.match_id !== matchId) continue;
    const prev = byGame.get(s.set_number);
    if (!prev || (s.created_at ?? '') >= (prev.created_at ?? '')) byGame.set(s.set_number, s);
  }
  return [...byGame.values()].sort((a, b) => a.set_number - b.set_number);
}
