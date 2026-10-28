// Day and 2-hour block planning. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoPlan, withDefaults, blockCapacity, matchesFor, playOrder } from '../lib/schedule.ts';

const entries = {
  male_singles_18plus: 24, female_singles_18plus: 12, male_singles_kids: 14, female_singles_kids: 10,
  male_doubles_18plus: 11, singles_u10: 6, spouse_doubles_open: 4, doubles_u10: 0,
};

test('10 or more entries play on day 1, fewer on day 2; empty categories are left out', () => {
  const { assign } = autoPlan(entries);
  for (const c of ['male_singles_18plus', 'female_singles_18plus', 'male_singles_kids', 'female_singles_kids', 'male_doubles_18plus']) assert.equal(assign[c].day, 0, c);
  assert.equal(assign.singles_u10.day, 1);
  assert.equal(assign.spouse_doubles_open.day, 1);
  assert.equal(assign.doubles_u10, undefined);
});

test('children play in the early blocks, adults later, and every block is used', () => {
  const { assign } = autoPlan(entries);
  assert.equal(assign.female_singles_kids.block, 0);
  assert.equal(assign.male_singles_18plus.block, 2);
  const day1 = Object.entries(assign).filter(([, s]) => s.day === 0).map(([, s]) => s.block);
  assert.deepEqual([...new Set(day1)].sort(), [0, 1, 2]);
  assert.deepEqual(playOrder(['male_singles_18plus', 'male_singles_kids', 'female_singles_kids']), ['female_singles_kids', 'male_singles_kids', 'male_singles_18plus']);
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

test('arranging a day: nobody is needed twice in one block, the courts are not overfilled, the family is not split far', () => {
  const block = arrangeDay(cats, day, 24);
  const d = describeDay(block, day);
  // dad plays 4 categories and there are 3 blocks, so one pair of them must share a block; nothing else may
  const dad = d.doubleBooked.filter((x) => x.name === 'dad');
  assert.ok(dad.length === 1 && dad[0].cats.length === 2, JSON.stringify(d.doubleBooked));
  assert.deepEqual(d.doubleBooked.filter((x) => x.name !== 'dad'), []);
  assert.ok(d.load.every((l) => l <= 24), `load ${d.load}`);
  const f = d.families.find((x) => x.family === 'F')!;
  assert.deepEqual(f.people.map((p) => p.name), ['dad', 'mum', 'son']);
  assert.ok(Object.keys(block).length === cats.length);
});

test('describing a day finds a person booked twice in the same block', () => {
  const all0 = Object.fromEntries(cats.map((c) => [c, 0]));
  const d = describeDay(all0, day);
  const dad = d.doubleBooked.find((x) => x.name === 'dad')!;
  assert.equal(dad.cats.length, 4);
  assert.equal(d.load[0], d.load.reduce((a, b) => a + b, 0));
});
