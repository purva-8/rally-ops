// Day-of schedule in 2-hour blocks. Each category is given a day and a block; its players come for that
// block and stay until they are knocked out. Pure functions only so they can be tested with `node --test`.
import { CATEGORY_DEFS, sortCategories } from './categories';

export const BLOCKS = ['4:00 – 6:00 PM', '6:00 – 8:00 PM', '8:00 – 10:00 PM'];
export const COURTS = 4;
export const BLOCK_MINUTES = 120;
// Categories with fewer entries than this play on the second day
export const SMALL_CATEGORY = 10;

export type Slot = { day: 0 | 1; block: number };
export type Schedule = { minutesPerMatch: number; assign: Record<string, Slot> };

// A knockout of n entries is n-1 matches
export const matchesFor = (entries: number) => Math.max(entries - 1, 0);
export const blockCapacity = (minutesPerMatch: number) => Math.floor(BLOCK_MINUTES / minutesPerMatch) * COURTS;

// Youngest play first: Under 10, kids, youth, then adults (and parent + child); singles before doubles in a band
function band(cat: string) {
  const max = CATEGORY_DEFS[cat]?.maxAge;
  if (max === undefined) return 3;
  return max <= 10 ? 0 : max <= 14 ? 1 : max <= 18 ? 2 : 3;
}
export function playOrder(cats: string[]) {
  const sorted = sortCategories(cats);
  return [...sorted].sort((a, b) => band(a) - band(b) || sorted.indexOf(a) - sorted.indexOf(b));
}

// Split categories, in play order, over the blocks so each block has about the same number of matches
function spread(cats: string[], entries: Record<string, number>, day: 0 | 1, out: Record<string, Slot>) {
  const ordered = playOrder(cats);
  const total = ordered.reduce((s, c) => s + matchesFor(entries[c] ?? 0), 0);
  const per = total / BLOCKS.length || 1;
  let before = 0;
  for (const c of ordered) {
    const m = matchesFor(entries[c] ?? 0);
    out[c] = { day, block: Math.min(BLOCKS.length - 1, Math.floor((before + m / 2) / per)) };
    before += m;
  }
}

// Big categories on day 1, small ones on day 2
export function autoPlan(entries: Record<string, number>, minutesPerMatch = 20): Schedule {
  const cats = Object.keys(entries).filter((c) => entries[c] > 0);
  const assign: Record<string, Slot> = {};
  spread(cats.filter((c) => entries[c] >= SMALL_CATEGORY), entries, 0, assign);
  spread(cats.filter((c) => entries[c] < SMALL_CATEGORY), entries, 1, assign);
  return { minutesPerMatch, assign };
}

// A saved schedule, with any category it doesn't cover yet (new entries) placed automatically
export function withDefaults(saved: unknown, entries: Record<string, number>): Schedule {
  const auto = autoPlan(entries);
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<Schedule>;
  const minutes = Number.isInteger(s.minutesPerMatch) && s.minutesPerMatch! >= 5 && s.minutesPerMatch! <= 60 ? s.minutesPerMatch! : auto.minutesPerMatch;
  const assign: Record<string, Slot> = { ...auto.assign };
  for (const [c, v] of Object.entries(s.assign ?? {})) if (validSlot(v)) assign[c] = { day: v.day, block: v.block };
  return { minutesPerMatch: minutes, assign };
}

export function validSlot(v: unknown): v is Slot {
  const x = v as Slot;
  return !!x && (x.day === 0 || x.day === 1) && Number.isInteger(x.block) && x.block >= 0 && x.block < BLOCKS.length;
}
