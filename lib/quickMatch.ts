// Matches made on the spot as players arrive (Score desk → Match maker): no bracket, no rounds drawn ahead.
// Pure so it can be tested with `node --test`.

export type QuickMatchRow = { round: number; status: string; player1_name: string | null; player2_name: string | null; winner_name: string | null; label?: string | null };
export type Standing = { wins: number; out: boolean; playing: boolean; champion: boolean };

// Where an entry stands in its category: matches won, lost one (out), has a match waiting or on court (playing),
// or won the match marked Final. Byes don't count.
export function standing(label: string, matches: QuickMatchRow[]): Standing {
  let wins = 0, out = false, playing = false, champion = false;
  for (const m of matches) {
    if (!m.player2_name || (m.player1_name !== label && m.player2_name !== label)) continue;
    if (m.status !== 'completed') { playing = true; continue; }
    if (m.winner_name === label) { wins++; if (m.label === 'Final') champion = true; } else out = true;
  }
  return { wins, out, playing, champion };
}

// A match's round is how far its players have got: two newcomers play Round 1, two who have each won once Round 2.
// If they have won different numbers of matches, the further one decides.
export const roundFor = (a: Standing, b: Standing) => Math.max(a.wins, b.wins);
export const roundName = (round: number, final: boolean) => (final ? 'Final' : `Round ${round + 1}`);

// Roll the dice: shuffle and pair off in order. With an odd number, the last one waits for the next match.
export function rollPairs<T>(items: T[], rand: () => number = Math.random): { pairs: [T, T][]; waiting: T | null } {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const pairs: [T, T][] = [];
  for (let i = 0; i + 1 < a.length; i += 2) pairs.push([a[i], a[i + 1]]);
  return { pairs, waiting: a.length % 2 ? a[a.length - 1] : null };
}
