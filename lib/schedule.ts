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

// ── Family-aware arrangement ──────────────────────────────────────────────────────────────────────
// Every person who plays, with the family they come with. One entry is one player, or a pair.
export type Person = { key: string; family: string; name: string };
export type Entry = { cat: string; people: Person[] };

// What the arrangement costs, worst first: matches beyond what the courts can hold, a family kept at the
// venue all evening (organizers asked for this not to happen; a player then plays two categories back to
// back in one block instead), a person needed in two categories in the same block (more for three), a
// family spread across blocks, courts standing idle or overfull, and (lightly) children playing late.
const W = { overload: 100, allEvening: 90, doubleBooked: 40, tripleBooked: 80, familySpread: 10, balance: 0.2, lateKids: 0.5 };

export type DayPlan = {
  block: Record<string, number>;
  load: number[];
  doubleBooked: { name: string; cats: string[]; block: number }[];
  families: { family: string; people: { name: string; cats: string[] }[]; blocks: number[] }[];
};

function index(cats: string[], entries: Entry[]) {
  const persons = new Map<string, { name: string; family: string; cats: Set<string> }>();
  const families = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!cats.includes(e.cat)) continue;
    for (const p of e.people) {
      const rec = persons.get(p.key) ?? { name: p.name, family: p.family, cats: new Set<string>() };
      rec.cats.add(e.cat);
      persons.set(p.key, rec);
      (families.get(p.family) ?? families.set(p.family, new Set()).get(p.family)!).add(p.key);
    }
  }
  const count: Record<string, number> = {};
  for (const e of entries) if (cats.includes(e.cat)) count[e.cat] = (count[e.cat] ?? 0) + 1;
  return { persons, families, count };
}

// Best block for each category of one day. Tries every arrangement when there are few enough
// (3^11 ≈ 177k), otherwise improves one category at a time until nothing gets better.
export function arrangeDay(cats: string[], entries: Entry[], capacity: number): Record<string, number> {
  const ordered = playOrder(cats);
  const n = ordered.length;
  if (!n) return {};
  const { persons, families, count } = index(ordered, entries);
  const ci = new Map(ordered.map((c, i) => [c, i]));
  const matches = ordered.map((c) => matchesFor(count[c] ?? 0));
  const personCats = [...persons.values()].map((p) => [...p.cats].map((c) => ci.get(c)!));
  const familyCats = [...families.values()].map((keys) => [...new Set([...keys].flatMap((k) => [...persons.get(k)!.cats].map((c) => ci.get(c)!)))]);
  const total = matches.reduce((a, b) => a + b, 0);
  const B = BLOCKS.length;

  const cost = (blk: number[]) => {
    const load = new Array(B).fill(0);
    for (let i = 0; i < n; i++) load[blk[i]] += matches[i];
    let c = 0;
    for (const l of load) c += W.overload * Math.max(0, l - capacity) + W.balance * (l - total / B) ** 2;
    for (const pc of personCats) if (pc.length > 1) {
      const per = new Array(B).fill(0);
      for (const i of pc) per[blk[i]]++;
      for (const k of per) if (k > 1) c += W.doubleBooked * (k - 1) + W.tripleBooked * Math.max(0, k - 2);
    }
    for (const fc of familyCats) if (fc.length > 1) {
      let lo = B, hi = -1;
      for (const i of fc) { lo = Math.min(lo, blk[i]); hi = Math.max(hi, blk[i]); }
      c += W.familySpread * (hi - lo) + (hi - lo === B - 1 ? W.allEvening : 0);
    }
    for (let i = 0; i < n; i++) c += W.lateKids * (3 - band(ordered[i])) * blk[i];
    return c;
  };

  let best = ordered.map((_, i) => Math.min(B - 1, Math.floor((i * B) / n)));
  let bestCost = cost(best);
  if (B ** n <= 177147) {
    const blk = new Array(n).fill(0);
    for (let code = 0; code < B ** n; code++) {
      let x = code;
      for (let i = 0; i < n; i++) { blk[i] = x % B; x = Math.floor(x / B); }
      const c = cost(blk);
      if (c < bestCost) { bestCost = c; best = [...blk]; }
    }
  } else {
    for (let improved = true; improved;) {
      improved = false;
      for (let i = 0; i < n; i++) for (let b = 0; b < B; b++) {
        if (b === best[i]) continue;
        const next = [...best]; next[i] = b;
        const c = cost(next);
        if (c < bestCost) { bestCost = c; best = next; improved = true; }
      }
    }
  }
  return Object.fromEntries(ordered.map((c, i) => [c, best[i]]));
}

// How a day's arrangement works out for people and families, for the screen
export function describeDay(block: Record<string, number>, entries: Entry[]): DayPlan {
  const cats = Object.keys(block);
  const { persons, families, count } = index(cats, entries);
  const load = BLOCKS.map((_, b) => cats.filter((c) => block[c] === b).reduce((s, c) => s + matchesFor(count[c] ?? 0), 0));
  const doubleBooked: DayPlan['doubleBooked'] = [];
  for (const p of persons.values()) {
    const byBlock = new Map<number, string[]>();
    for (const c of p.cats) byBlock.set(block[c], [...(byBlock.get(block[c]) ?? []), c]);
    for (const [b, cs] of byBlock) if (cs.length > 1) doubleBooked.push({ name: p.name, cats: playOrder(cs), block: b });
  }
  const out: DayPlan['families'] = [];
  for (const [family, keys] of families) {
    const people = [...keys].map((k) => ({ name: persons.get(k)!.name, cats: playOrder([...persons.get(k)!.cats]) }));
    const blocks = [...new Set(people.flatMap((p) => p.cats.map((c) => block[c])))].sort();
    out.push({ family, people: people.sort((a, b) => a.name.localeCompare(b.name)), blocks });
  }
  out.sort((a, b) => b.people.length - a.people.length || a.people[0].name.localeCompare(b.people[0].name));
  return { block, load, doubleBooked, families: out };
}

// Keep each category on its day and give it the best block for that day
export function arrangeSchedule(s: Schedule, entries: Entry[]): Schedule {
  const assign: Record<string, Slot> = { ...s.assign };
  for (const day of [0, 1] as const) {
    const cats = Object.keys(s.assign).filter((c) => s.assign[c].day === day);
    const blk = arrangeDay(cats, entries, blockCapacity(s.minutesPerMatch));
    for (const c of cats) assign[c] = { day, block: blk[c] };
  }
  return { ...s, assign };
}
