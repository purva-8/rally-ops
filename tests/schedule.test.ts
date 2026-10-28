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
