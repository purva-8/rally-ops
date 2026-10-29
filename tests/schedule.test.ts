// Day and 2-hour block planning. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoPlan, withDefaults, blockCapacity, matchesFor, playOrder, dayItems, round1Matches } from '../lib/schedule.ts';

const entries = {
  male_singles_18plus: 24, female_singles_18plus: 12, male_singles_kids: 14, female_singles_kids: 10,
  male_doubles_18plus: 11, singles_u10: 6, spouse_doubles_open: 4, doubles_u10: 0,
};

test("the organizers' first-day list plays on 30/10, everything else on 06/11; empty categories are left out", () => {
  const { assign, firstDayRound1 } = autoPlan(entries);
  assert.equal(firstDayRound1, true);
  for (const c of ['male_singles_18plus', 'female_singles_18plus', 'male_singles_kids', 'male_doubles_18plus', 'singles_u10']) assert.equal(assign[c].day, 0, c);
  assert.equal(assign.female_singles_kids.day, 1, 'not on the first-day list');
  assert.equal(assign.spouse_doubles_open.day, 1);
  assert.equal(assign.doubles_u10, undefined);
  // an event with none of the first-day categories falls back to size: 10 or more on day 1
  const other = autoPlan({ female_singles_kids: 12, spouse_doubles_open: 4 }).assign;
  assert.deepEqual([other.female_singles_kids.day, other.spouse_doubles_open.day], [0, 1]);
});

test('children play in the early blocks, adults later, and every block is used', () => {
  const { assign } = autoPlan(entries);
  assert.equal(assign.singles_u10.block, 0);
  assert.ok(assign.male_singles_18plus.block > assign.male_singles_kids.block, 'adults after children');
  const day1 = Object.entries(assign).filter(([, s]) => s.day === 0).map(([, s]) => s.block);
  assert.deepEqual([...new Set(day1)].sort(), [0, 1, 2]);
  assert.deepEqual(playOrder(['male_singles_18plus', 'male_singles_kids', 'female_singles_kids']), ['female_singles_kids', 'male_singles_kids', 'male_singles_18plus']);
});

test('round 1 only on the first day: n/2 matches there, the rest on day 2 as later rounds', () => {
  const s = autoPlan(entries);
  const [day0, day1] = dayItems(s, entries);
  assert.equal(day0.male_singles_18plus, 12, '24 entries: 12 round-1 matches');
  assert.equal(day0.male_doubles_18plus, 5, '11 entries: 5 matches, one waits');
  assert.equal(day1.male_singles_18plus__later, 11);
  assert.equal(day1.male_doubles_18plus__later, 5);
  assert.equal(day1.female_singles_kids, 9, 'a day-2 category plays its whole draw');
  assert.equal(day1.spouse_doubles_open__later, undefined);
  // turned off, the first day plays whole draws
  const [all] = dayItems({ ...s, firstDayRound1: false }, entries);
  assert.equal(all.male_singles_18plus, 23);
  assert.equal(round1Matches(7), 3);
});

test('a saved schedule wins; junk is ignored; new categories are filled in', () => {
  const s = withDefaults({ minutesPerMatch: 25, assign: { singles_u10: { day: 0, block: 0 }, male_singles_18plus: { day: 5, block: 0 } } }, entries);
  assert.equal(s.minutesPerMatch, 25);
  assert.deepEqual(s.assign.singles_u10, { day: 0, block: 0 });
  assert.equal(s.assign.male_singles_18plus.day, 0, 'bad slot falls back to automatic');
  assert.ok(s.assign.female_singles_kids);
  assert.equal(withDefaults(null, entries).minutesPerMatch, 20);
});

test('capacity: 4 courts for 2 hours', () => {
  assert.equal(blockCapacity(20), 24);
  assert.equal(blockCapacity(25), 16);
  assert.equal(matchesFor(1), 0);
  assert.equal(matchesFor(12), 11);
});

import { arrangeDay, describeDay, type Entry } from '../lib/schedule.ts';

// A family: dad plays Male 18+ singles, Male 18+ doubles, Spouse with mum and Parent + Child with their son,
// who also plays Boys 10-14. Plus strangers to fill the categories.
const fam = (k: string, f: string) => ({ key: k, family: f, name: k });
const solo = (cat: string, k: string): Entry => ({ cat, people: [fam(k, k)] });
const pair = (cat: string, a: string, b: string, fa = a, fb = b): Entry => ({ cat, people: [fam(a, fa), fam(b, fb)] });
const family: Entry[] = [
  solo('male_singles_18plus', 'dad'),
  pair('male_doubles_18plus', 'dad', 'friend', 'F', 'friend'),
  pair('spouse_doubles_open', 'dad', 'mum', 'F', 'F'),
  pair('mixed_doubles_open', 'dad', 'son', 'F', 'F'),
  solo('male_singles_kids', 'son'),
].map((e) => ({ ...e, people: e.people.map((p) => (['dad', 'mum', 'son'].includes(p.key) ? { ...p, family: 'F' } : p)) }));
const fill = (cat: string, n: number, doubles = false) => Array.from({ length: n }, (_, i) =>
  doubles ? pair(cat, `${cat}-a${i}`, `${cat}-b${i}`) : solo(cat, `${cat}-${i}`));
const day: Entry[] = [
  ...family,
  ...fill('male_singles_18plus', 15), ...fill('male_doubles_18plus', 7, true), ...fill('spouse_doubles_open', 5, true),
  ...fill('mixed_doubles_open', 5, true), ...fill('male_singles_kids', 9), ...fill('singles_u10', 8),
];
const cats = ['singles_u10', 'male_singles_kids', 'male_singles_18plus', 'mixed_doubles_open', 'male_doubles_18plus', 'spouse_doubles_open'];

test('arranging a day: no family all evening, nobody in three categories at once, the courts are not overfilled', () => {
  const block = arrangeDay(cats, day, 24);
  const d = describeDay(block, day);
  const f = d.families.find((x) => x.family === 'F')!;
  assert.deepEqual(f.people.map((p) => p.name), ['dad', 'mum', 'son']);
  assert.ok(d.families.every((x) => x.blocks.length < 3), JSON.stringify(d.families.filter((x) => x.blocks.length === 3)));
  // dad's 4 categories fit in 2 blocks only by pairing them up: two at a time, never three
  assert.ok(d.doubleBooked.every((x) => x.cats.length === 2), JSON.stringify(d.doubleBooked));
  assert.deepEqual(d.doubleBooked.filter((x) => x.name !== 'dad' && x.name !== 'son'), []);
  assert.ok(d.load.every((l) => l <= 24), `load ${d.load}`);
  assert.ok(Object.keys(block).length === cats.length);
});

test('describing a day finds a person booked twice in the same block', () => {
  const all0 = Object.fromEntries(cats.map((c) => [c, 0]));
  const d = describeDay(all0, day);
  const dad = d.doubleBooked.find((x) => x.name === 'dad')!;
  assert.equal(dad.cats.length, 4);
  assert.equal(d.load[0], d.load.reduce((a, b) => a + b, 0));
});
