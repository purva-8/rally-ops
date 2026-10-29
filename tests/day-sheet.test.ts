// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tidyName, entryStatus, SHEET_SLOTS, type SheetMatch } from '../lib/daySheet.ts';

test('names in all lower or upper case are capitalised, others left alone', () => {
  assert.equal(tidyName('ishna priyadarshi'), 'Ishna Priyadarshi');
  assert.equal(tidyName('KRITAG SINGH'), 'Kritag Singh');
  assert.equal(tidyName('  anu   rao / RAVI rao '), 'anu rao / RAVI rao');
  assert.equal(tidyName('McDonald'), 'McDonald');
});

test('status: wins, knocked out, champion from the final; byes and unfinished matches do not count', () => {
  const m = (round: number, a: string, b: string | null, w: string | null, status = 'completed'): SheetMatch => ({ round, status, player1_name: a, player2_name: b, winner_name: w });
  // 4 entries: final is round 1
  const ms = [m(0, 'A', 'B', 'A'), m(0, 'C', 'D', 'D'), m(1, 'A', 'D', 'A')];
  assert.deepEqual(entryStatus('A', ms, 4), { wins: 2, out: false, champion: true });
  assert.deepEqual(entryStatus('D', ms, 4), { wins: 1, out: true, champion: false });
  assert.deepEqual(entryStatus('B', ms, 4), { wins: 0, out: true, champion: false });
  // 3 entries: a bye in round 0, final in round 1; a live final decides nothing yet
  const odd = [m(0, 'E', null, 'E'), m(0, 'F', 'G', 'F'), m(1, 'E', 'F', null, 'in_progress')];
  assert.deepEqual(entryStatus('E', odd, 3), { wins: 0, out: false, champion: false });
  assert.deepEqual(entryStatus('G', odd, 3), { wins: 0, out: true, champion: false });
});

test('the six first-day categories are in the two slots once each', () => {
  const all = SHEET_SLOTS.flatMap((s) => s.categories);
  assert.equal(new Set(all).size, 6);
  assert.deepEqual(SHEET_SLOTS.map((s) => `${s.from}-${s.to}`), ['4:00 PM-7:00 PM', '7:00 PM-10:00 PM']);
});
