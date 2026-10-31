// The one-page sheet for the first day (/board): who plays in which slot, and how each entry is doing.
// Pure functions only so they can be tested with `node --test`.

// The organizers' slots and courts for 30/10
export type SheetCategory = { key: string; court: number; round?: string };
// columns: how many categories sit side by side in the slot (default up to 3)
export const SHEET_SLOTS: { from: string; to: string; columns?: number; categories: SheetCategory[] }[] = [
  { from: '4:00 PM', to: '7:00 PM', categories: [
    { key: 'male_singles_18plus', court: 6, round: 'Round 1' },
    { key: 'male_doubles_18plus', court: 9, round: 'Round 1' },
    { key: 'male_singles_kids', court: 8, round: 'Round 1' },
    { key: 'female_singles_18plus', court: 7, round: 'Round 1' },
    { key: 'singles_u10', court: 7, round: 'Round 1' },
  ] },
  { from: '7:00 PM', to: '10:00 PM', columns: 1, categories: [
    { key: 'spouse_doubles_open', court: 8 },
    { key: 'female_singles_kids', court: 7 },
  ] },
];

// Names typed all in lower or upper case are shown capitalised; anything else as entered
export function tidyName(name: string) {
  const t = name.trim().replace(/\s+/g, ' ');
  if (t !== t.toLowerCase() && t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s/&.'-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

export type SheetMatch = { round: number; status: string; player1_name: string | null; player2_name: string | null; winner_name: string | null; label?: string | null };
export type EntryStatus = { wins: number; out: boolean; champion: boolean };

// How an entry stands from its category's matches: matches won (byes don't count), knocked out, or champion.
// The final is the match marked Final (made on the spot); in an old drawn bracket, round ceil(log2 entries) - 1.
export function entryStatus(label: string, matches: SheetMatch[], entries: number): EntryStatus {
  const finalRound = Math.ceil(Math.log2(Math.max(entries, 2))) - 1;
  let wins = 0, out = false, champion = false;
  for (const m of matches) {
    if (m.status !== 'completed' || !m.player2_name || !inMatch(label, m)) continue;
    if (sameName(m.winner_name, label)) { wins++; if (m.label ? m.label === 'Final' : m.round === finalRound) champion = true; } else out = true;
  }
  return { wins, out, champion };
}

// Names as typed into a profile and as saved on a match can differ in spacing and capitals ("Pranav Nidhin " and
// "Pranav Nidhin"); they are the same person
export const sameName = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();
export const inMatch = (label: string, m: Pick<SheetMatch, 'player1_name' | 'player2_name'>) =>
  sameName(m.player1_name, label) || sameName(m.player2_name, label);

// The knockout rounds left for a category with n entries still in: the final for 2, semi-finals first for 3-4,
// knockout rounds before that for more. Short of a full round (3, 5-7, 9-15 entries), some go through without
// playing (byes); who gets them is the organizers' call.
export function roundsAhead(n: number): { rounds: string[]; byes: number } {
  if (n < 2) return { rounds: [], byes: 0 };
  const size = 2 ** Math.ceil(Math.log2(n));
  const rounds = ['Final'];
  if (size >= 4) rounds.unshift('Semi-finals');
  for (let s = 8; s <= size; s *= 2) rounds.unshift('Knockout');
  return { rounds, byes: size - n };
}
