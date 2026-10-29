// The one-page sheet for the first day (/board): who plays in which slot, and how each entry is doing.
// Pure functions only so they can be tested with `node --test`.

// The organizers' slots for 30/10: children, parent + child and women's singles first, then the men
export const SHEET_SLOTS = [
  { from: '4:00 PM', to: '7:00 PM', categories: ['singles_u10', 'male_singles_kids', 'mixed_doubles_open', 'female_singles_18plus'] },
  { from: '7:00 PM', to: '10:00 PM', categories: ['male_singles_18plus', 'male_doubles_18plus'] },
];

// Names typed all in lower or upper case are shown capitalised; anything else as entered
export function tidyName(name: string) {
  const t = name.trim().replace(/\s+/g, ' ');
  if (t !== t.toLowerCase() && t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s/&.'-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

export type SheetMatch = { round: number; status: string; player1_name: string | null; player2_name: string | null; winner_name: string | null };
export type EntryStatus = { wins: number; out: boolean; champion: boolean };

// How an entry stands from its category's matches: matches won (byes don't count), knocked out, or champion.
// The final is in round ceil(log2 entries) - 1 (see lib/bracket).
export function entryStatus(label: string, matches: SheetMatch[], entries: number): EntryStatus {
  const finalRound = Math.ceil(Math.log2(Math.max(entries, 2))) - 1;
  let wins = 0, out = false, champion = false;
  for (const m of matches) {
    if (m.status !== 'completed' || !m.player2_name || (m.player1_name !== label && m.player2_name !== label)) continue;
    if (m.winner_name === label) { wins++; if (m.round === finalRound) champion = true; } else out = true;
  }
  return { wins, out, champion };
}
