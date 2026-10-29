// Matches made on the spot as players arrive (Score desk → Match maker). Run with: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, session } from './support/fakeSupabase.ts';
import { POST as make, DELETE as unmake } from '../app/api/tournament/matches/quick/route.ts';
import { POST as score } from '../app/api/tournament/matches/score/route.ts';
import { rollPairs, standing } from '../lib/quickMatch.ts';
import { toClientMatches } from '../lib/matchRows.ts';
import { entryStatus } from '../lib/daySheet.ts';

const T = 't1', ORG = 'u-org';
function call(fn: (r: any) => Promise<Response>, body: Record<string, unknown>, user: string | null = ORG) {
  session.user = user ? { id: user } : null;
  return fn(new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }) as any)
    .then(async (r: Response) => ({ status: r.status, body: await r.json() }));
}
const pair = (a: string, b: string) => ({ player1: { id: `id-${a}`, name: a }, player2: { id: null, name: b } });
const makeMatches = (pairs: object[], extra: object = {}) => call(make, { tournamentId: T, category: 'ms', pairs, ...extra });
const win = (matchId: string, side: 1 | 2) => call(score, { matchId, status: 'completed',
  sets: side === 1 ? [{ player1Score: 21, player2Score: 5 }, { player1Score: 21, player2Score: 7 }] : [{ player1Score: 5, player2Score: 21 }, { player1Score: 7, player2Score: 21 }] });
const byName = (a: string) => db.matches.find((m) => m.player1_name === a && m.status !== 'completed')!;

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.tournaments = [{ id: T, created_by: ORG }];
  db.tournament_staff = [];
  db.player_profiles = [{ id: 'id-A' }];
  db.matches = [];
  db.match_sets = [];
});

test('the dice pair everyone off; an odd one waits', () => {
  let i = 0;
  const seq = [0.9, 0.1, 0.5, 0.3, 0.7];
  const r = rollPairs(['A', 'B', 'C', 'D', 'E'], () => seq[i++ % seq.length]);
  assert.equal(r.pairs.length, 2);
  assert.ok(r.waiting);
  assert.deepEqual([...r.pairs.flat(), r.waiting].sort(), ['A', 'B', 'C', 'D', 'E']);
  assert.deepEqual(rollPairs(['A', 'B']).pairs.flat().sort(), ['A', 'B']);
  assert.equal(rollPairs(['A']).pairs.length, 0);
});

test('four arrive, then two: Round 1 matches as they come, straight onto the Score desk; winners meet in Round 2, then the final', async () => {
  assert.equal((await makeMatches([pair('A', 'B'), pair('C', 'D')])).status, 200);
  assert.equal((await makeMatches([pair('E', 'F')])).status, 200);
  assert.deepEqual(db.matches.map((m) => [m.round, m.position, m.label, m.status]), [[0, 0, 'Round 1', 'upcoming'], [0, 1, 'Round 1', 'upcoming'], [0, 2, 'Round 1', 'upcoming']]);
  assert.equal(db.matches[0].player1_id, 'id-A', 'a real profile is linked');
  assert.equal(db.matches[0].player2_id, null, 'someone entered at the desk is stored by name');

  await win(byName('A').id, 1); await win(byName('C').id, 2); await win(byName('E').id, 1);
  assert.equal(db.matches.length, 3, 'nothing drawn by itself');

  // A and D have each won once: Round 2. E waits.
  await makeMatches([pair('A', 'D')]);
  const r2 = db.matches.find((m) => m.player1_name === 'A' && m.round === 1)!;
  assert.deepEqual([r2.label, r2.position], ['Round 2', 0]);
  await win(r2.id, 1);
  // A (2 wins) v E (1 win) marked as the final
  await makeMatches([pair('A', 'E')], { final: true });
  const final = byName('A');
  assert.deepEqual([final.round, final.label], [2, 'Final']);
  await win(final.id, 2);
  const view = toClientMatches(db.matches, []);
  assert.deepEqual(view.map((m) => m.roundName), ['Round 1', 'Round 1', 'Round 1', 'Round 2', 'Final']);
  assert.equal(standing('E', db.matches).champion, true);
  assert.equal(entryStatus('E', db.matches, 6).champion, true, 'the board shows the champion');
  assert.equal(entryStatus('A', db.matches, 6).out, true);
});

test('refused: someone already on court or waiting, someone already out, the same person twice, non-organizers', async () => {
  await makeMatches([pair('A', 'B')]);
  assert.equal((await makeMatches([pair('A', 'C')])).status, 409, 'A has a match waiting');
  await win(byName('A').id, 1);
  assert.equal((await makeMatches([pair('B', 'C')])).status, 409, 'B lost');
  assert.equal((await makeMatches([pair('C', 'D'), pair('C', 'E')])).status, 400);
  assert.equal((await makeMatches([pair('C', '')])).status, 400);
  assert.equal((await makeMatches([pair('C', 'D'), pair('E', 'F')], { final: true })).status, 400, 'a final is one match');
  assert.equal((await call(make, { tournamentId: T, category: 'ms', pairs: [pair('C', 'D')] }, 'u-stranger')).status, 403);
  assert.equal(db.matches.length, 1);
});

test('a match rolled by mistake can be taken back until it has a score', async () => {
  await makeMatches([pair('A', 'B'), pair('C', 'D')]);
  const [m1, m2] = db.matches;
  assert.equal((await call(unmake, { tournamentId: T, matchId: m1.id })).status, 200);
  assert.deepEqual(db.matches.map((m) => m.id), [m2.id]);
  // A and B can be paired again
  assert.equal((await makeMatches([pair('A', 'C')])).status, 409, 'C is still in a match');
  assert.equal((await makeMatches([pair('A', 'B')])).status, 200);
  await call(score, { matchId: m2.id, sets: [{ player1Score: 3, player2Score: 1 }], status: 'in_progress' });
  assert.equal((await call(unmake, { tournamentId: T, matchId: m2.id })).status, 409);
  assert.equal((await call(unmake, { tournamentId: T, matchId: m2.id }, 'u-stranger')).status, 403);
});
