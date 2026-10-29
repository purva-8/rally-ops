// A round with an odd number of winners: the last one waits a round. Run with: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, session } from './support/fakeSupabase.ts';
import { POST as score } from '../app/api/tournament/matches/score/route.ts';
import { POST as reset } from '../app/api/tournament/matches/reset/route.ts';

const T = 't1', ORG = 'u-org';
function call(fn: (r: any) => Promise<Response>, body: Record<string, unknown>) {
  session.user = { id: ORG };
  return fn(new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }) as any)
    .then(async (r: Response) => ({ status: r.status, body: await r.json() }));
}
const won = (side: 1 | 2) => (side === 1 ? [{ player1Score: 21, player2Score: 5 }, { player1Score: 21, player2Score: 7 }] : [{ player1Score: 5, player2Score: 21 }, { player1Score: 7, player2Score: 21 }]);
const m = (id: string, position: number, a: string, b: string) =>
  ({ id, tournament_id: T, category: 'ms', round: 0, position, player1_id: null, player1_name: a, player2_id: null, player2_name: b, status: 'upcoming', created_at: '2026-01-01' });
const round = (r: number) => db.matches.filter((x) => x.round === r).sort((a, b) => a.position - b.position);

// 6 entries: 3 matches, then 2 of the 3 winners play while the third waits, then the final
beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.tournaments = [{ id: T, created_by: ORG }];
  db.tournament_staff = [];
  db.player_profiles = [];
  db.matches = [m('a', 0, 'A', 'B'), m('b', 1, 'C', 'D'), m('c', 2, 'E', 'F')];
  db.match_sets = [];
});

test('three winners: one match and one bye, then the final against the one who waited', async () => {
  for (const id of ['a', 'b', 'c']) await call(score, { matchId: id, sets: won(1), status: 'completed' });
  const r1 = round(1);
  assert.deepEqual(r1.map((x) => [x.player1_name, x.player2_name, x.status, x.winner_name ?? null]), [['A', 'C', 'upcoming', null], ['E', null, 'completed', 'E']]);
  await call(score, { matchId: r1[0].id, sets: won(2), status: 'completed' });
  assert.deepEqual(round(2).map((x) => [x.player1_name, x.player2_name]), [['C', 'E']]);
  const final = round(2)[0];
  const r = await call(score, { matchId: final.id, sets: won(1), status: 'completed' });
  assert.equal(r.body.nextMatches.length, 0);
  assert.equal(db.matches.length, 6);
});

test('correcting the result whose winner waited moves the new winner through the bye into the final', async () => {
  for (const id of ['a', 'b', 'c']) await call(score, { matchId: id, sets: won(1), status: 'completed' });
  await call(score, { matchId: round(1)[0].id, sets: won(1), status: 'completed' });
  const fix = await call(score, { matchId: 'c', sets: won(2), status: 'completed' });
  assert.equal(fix.status, 200);
  const bye = round(1)[1];
  assert.deepEqual([bye.player1_name, bye.winner_name], ['F', 'F']);
  assert.deepEqual(round(2).map((x) => [x.player1_name, x.player2_name]), [['A', 'F']]);
  // once the final has a score the earlier result is locked
  await call(score, { matchId: round(2)[0].id, sets: [{ player1Score: 3, player2Score: 1 }], status: 'in_progress' });
  assert.equal((await call(score, { matchId: 'c', sets: won(1), status: 'completed' })).status, 409);
});

test('undo works with a bye waiting in the next round', async () => {
  for (const id of ['a', 'b', 'c']) await call(score, { matchId: id, sets: won(1), status: 'completed' });
  const r = await call(reset, { matchId: 'b' });
  assert.equal(r.status, 200);
  assert.equal(round(1).length, 0, 'the next round (with its bye) is removed until b is played again');
  await call(score, { matchId: 'b', sets: won(2), status: 'completed' });
  assert.deepEqual(round(1).map((x) => [x.player1_name, x.player2_name]), [['A', 'D'], ['E', null]]);
});
