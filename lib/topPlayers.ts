// Top players (/top): who has won the most matches, ties broken by rally points scored. Byes and matches not yet
// finished don't count. Pure so it can be tested with `node --test`.

import { tidyName } from './daySheet';

export type TopMatch = {
  category: string; status: string; isBye?: boolean; player1Name: string; player2Name?: string | null; winnerName?: string | null;
  sets: { player1Score: number; player2Score: number }[];
};
export type TopRow = { name: string; categories: string[]; played: number; won: number; lost: number; pointsFor: number; pointsAgainst: number };

const key = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

// byPerson: each person on their own line, doubles partners each credited with the pair's result (the "All" view).
// Otherwise one line per entry as it plays ("A / B" for a doubles pair).
export function rankPlayers(matches: TopMatch[], byPerson: boolean): TopRow[] {
  const rows = new Map<string, TopRow>();
  const add = (label: string, cat: string, won: boolean, pf: number, pa: number) => {
    const names = byPerson ? label.split(/\s*\/\s*/) : [label];
    for (const n of names.map((x) => x.trim()).filter(Boolean)) {
      const r = rows.get(key(n)) ?? { name: tidyName(n), categories: [], played: 0, won: 0, lost: 0, pointsFor: 0, pointsAgainst: 0 };
      if (!r.categories.includes(cat)) r.categories.push(cat);
      r.played++; if (won) r.won++; else r.lost++;
      r.pointsFor += pf; r.pointsAgainst += pa;
      rows.set(key(n), r);
    }
  };
  for (const m of matches) {
    if (m.isBye || m.status !== 'completed' || !m.player2Name || !m.winnerName) continue;
    const p1 = m.sets.reduce((s, g) => s + g.player1Score, 0), p2 = m.sets.reduce((s, g) => s + g.player2Score, 0);
    const p1won = key(m.winnerName) === key(m.player1Name);
    add(m.player1Name, m.category, p1won, p1, p2);
    add(m.player2Name, m.category, !p1won, p2, p1);
  }
  return [...rows.values()].sort((a, b) => b.won - a.won || b.pointsFor - a.pointsFor || a.name.localeCompare(b.name));
}
