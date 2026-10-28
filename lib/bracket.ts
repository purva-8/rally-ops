// Knockout bracket rules shared by the server routes and the browser store.
// Pure functions only (no imports) so they can be tested with `node --test`.

export type SetScore = { player1Score: number; player2Score: number };

export type BracketMatch = {
  id: string;
  round: number;
  position?: number | null;
  created_at?: string | null;
  status: string;
  winner_id?: string | null;
  winner_name?: string | null;
};

// Round 1 always has size/2 slots (a bye counts as a slot), so the bracket size comes from it,
// not from whichever later rounds happen to exist yet.
export function totalRoundsFor(round0Count: number) {
  if (round0Count < 1) return 0;
  return Math.ceil(Math.log2(round0Count * 2));
}

export function roundLabel(round: number, totalRounds: number) {
  const fromEnd = totalRounds - 1 - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinal';
  if (fromEnd === 2) return 'Quarterfinal';
  return `Round ${round + 1}`;
}

// Same rule the store has always used: a set goes to whoever scored more in it, the match to whoever won more sets.
// Returns 1 or 2, or null when the sets are level (no winner yet).
export function winnerSide(sets: SetScore[]): 1 | 2 | null {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.player1Score > s.player2Score) a++;
    else if (s.player2Score > s.player1Score) b++;
  }
  if (a > b) return 1;
  if (b > a) return 2;
  return null;
}

// BWF game: first to 21 with a 2-point lead, or 30 at most (30-29). Returns the side that won the game,
// or null while it is still being played. Confirmed by the organizers for every category.
export function gameWinner(s: SetScore): 1 | 2 | null {
  const hi = Math.max(s.player1Score, s.player2Score);
  const lo = Math.min(s.player1Score, s.player2Score);
  const over = (hi === 21 && lo <= 19) || (hi > 21 && hi <= 30 && hi - lo === 2) || (hi === 30 && lo === 29);
  if (!over) return null;
  return s.player1Score > s.player2Score ? 1 : 2;
}

// A score no BWF game can reach (25-3, 31-29, 22-19): impossible whether finished or not
export function impossibleGame(s: SetScore) {
  const hi = Math.max(s.player1Score, s.player2Score);
  const lo = Math.min(s.player1Score, s.player2Score);
  if (hi > 30) return true;
  if (hi > 21 && hi - lo > 2) return true;
  if (hi === 30 && lo < 28) return true;
  return false;
}

// Best of 3 games. Returns the winning side, or a reason the score can't finish the match.
export function bwfResult(sets: SetScore[]): { winner: 1 | 2 } | { problem: string } {
  let a = 0;
  let b = 0;
  for (let i = 0; i < sets.length; i++) {
    if (a === 2 || b === 2) return { problem: `Game ${i + 1} was played after the match was already won` };
    if (impossibleGame(sets[i])) return { problem: `Game ${i + 1} (${sets[i].player1Score}-${sets[i].player2Score}) is not a possible badminton score` };
    const w = gameWinner(sets[i]);
    if (!w) return { problem: `Game ${i + 1} (${sets[i].player1Score}-${sets[i].player2Score}) is not finished: a game ends at 21 with a 2-point lead, or 30` };
    if (w === 1) a++; else b++;
  }
  if (a === 2) return { winner: 1 };
  if (b === 2) return { winner: 2 };
  return { problem: 'Nobody has won 2 games yet' };
}

export function validSets(sets: unknown): sets is SetScore[] {
  return Array.isArray(sets) && sets.length <= 5 && sets.every((s) =>
    s && typeof s === 'object'
    && Number.isInteger((s as SetScore).player1Score) && Number.isInteger((s as SetScore).player2Score)
    && (s as SetScore).player1Score >= 0 && (s as SetScore).player2Score >= 0
    && (s as SetScore).player1Score <= 99 && (s as SetScore).player2Score <= 99);
}

// Bracket order inside a round: the saved position, then creation time, then id (stable fallback for old rows)
export function bracketOrder<T extends BracketMatch>(a: T, b: T) {
  const pa = a.position ?? Number.MAX_SAFE_INTEGER;
  const pb = b.position ?? Number.MAX_SAFE_INTEGER;
  if (pa !== pb) return pa - pb;
  const ca = a.created_at ?? '';
  const cb = b.created_at ?? '';
  if (ca !== cb) return ca < cb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// The next round's matches once every match of `round` is completed, or null when it is not due yet.
// Winner of slot 2k meets winner of slot 2k+1.
export function nextRoundFor(categoryMatches: BracketMatch[], round: number) {
  const current = categoryMatches.filter((m) => m.round === round).sort(bracketOrder);
  if (current.length < 2) return null; // a single match in a round is the final
  if (categoryMatches.some((m) => m.round === round + 1)) return null; // already made
  // Entries added by hand have no profile id, so a winner is known by id or by name
  if (!current.every((m) => m.status === 'completed' && (m.winner_id || m.winner_name))) return null;
  const pairs: { position: number; player1Id: string | null; player1Name: string; player2Id: string | null; player2Name: string }[] = [];
  for (let i = 0; i + 1 < current.length; i += 2) {
    pairs.push({
      position: i / 2,
      player1Id: current[i].winner_id ?? null,
      player1Name: current[i].winner_name ?? '',
      player2Id: current[i + 1].winner_id ?? null,
      player2Name: current[i + 1].winner_name ?? '',
    });
  }
  return pairs;
}

// The later-round match a result feeds, and which side of it the winner sits on (same order as nextRoundFor)
export function nextSlotOf<T extends BracketMatch>(categoryMatches: T[], matchId: string): { next: T; side: 1 | 2 } | null {
  const self = categoryMatches.find((m) => m.id === matchId);
  if (!self) return null;
  const i = categoryMatches.filter((m) => m.round === self.round).sort(bracketOrder).findIndex((m) => m.id === matchId);
  const next = categoryMatches.filter((m) => m.round === self.round + 1).sort(bracketOrder)[i >> 1];
  return next ? { next, side: i % 2 === 0 ? 1 : 2 } : null;
}
