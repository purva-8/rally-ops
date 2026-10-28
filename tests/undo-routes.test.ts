// Undo a result, delete a draw, put a deleted draw back. Run with: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, session } from './support/fakeSupabase.ts';
import { POST as reset } from '../app/api/tournament/matches/reset/route.ts';
import { DELETE as deleteDraw } from '../app/api/tournament/brackets/route.ts';
import { POST as restore } from '../app/api/tournament/brackets/restore/route.ts';
import { POST as score } from '../app/api/tournament/matches/score/route.ts';

const T = 't1', ORG = 'u-org', COORG = 'u-coorg', COACH = 'u-coach';

function call(fn: (r: any) => Promise<Response>, user: string | null, body: Record<string, unknown>) {
  session.user = user ? { id: user } : null;
  return fn(new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }) as any)
    .then(async (r: Response) => ({ status: r.status, body: await r.json() }));
}
const set = (a: number, b: number) => ({ player1Score: a, player2Score: b });
const m = (id: string, round: number, position: number, p1: string, p2: string | null, extra: object = {}) =>
  ({ id, tournament_id: T, category: 'ms', round, position, player1_id: null, player1_name: p1, player2_id: null, player2_name: p2, status: 'upcoming', created_at: '2026-01-01', ...extra });

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.tournaments = [{ id: T, created_by: ORG }];
  db.tournament_staff = [
    { id: 's1', tournament_id: T, user_id: COACH, role: 'coach', status: 'active' },
    { id: 's2', tournament_id: T, user_id: COORG, role: 'admin', status: 'active' },
  ];
  db.player_profiles = [];
  // 4 players: A v B, C v D; then the final
  db.matches = [m('m1', 0, 0, 'A', 'B'), m('m2', 0, 1, 'C', 'D'), m('other', 0, 0, 'X', 'Y', { category: 'ws' })];
  db.match_sets = [];
});

const finishRound0 = async () => {
  await call(score, ORG, { matchId: 'm1', sets: [set(21, 5), set(21, 7)], status: 'completed' });
  await call(score, ORG, { matchId: 'm2', sets: [set(21, 5), set(21, 7)], status: 'completed' });
};

test('undo puts a finished match back to be played; only organizers may', async () => {
  await call(score, ORG, { matchId: 'm1', sets: [set(21, 5), set(21, 7)], status: 'completed' });
  assert.equal((await call(reset, null, { matchId: 'm1' })).status, 401);
  assert.equal((await call(reset, COACH, { matchId: 'm1' })).status, 403);
  const r = await call(reset, COORG, { matchId: 'm1' });
  assert.equal(r.status, 200);
  const row = db.matches.find((x) => x.id === 'm1')!;
  assert.deepEqual([row.status, row.winner_name, row.completed_at], ['upcoming', null, null]);
  assert.equal(db.match_sets.filter((s) => s.match_id === 'm1').length, 0);
  assert.equal(r.body.match.status, 'upcoming');
});

test('undo removes an unplayed later round, which is drawn again when the round finishes again', async () => {
  await finishRound0();
  assert.equal(db.matches.filter((x) => x.round === 1).length, 1);
  const r = await call(reset, ORG, { matchId: 'm2' });
  assert.equal(r.status, 200);
  assert.equal(r.body.removedIds.length, 1);
  assert.equal(db.matches.filter((x) => x.round === 1).length, 0);
  await call(score, ORG, { matchId: 'm2', sets: [set(5, 21), set(7, 21)], status: 'completed' });
  const final = db.matches.filter((x) => x.round === 1);
  assert.deepEqual(final.map((x) => [x.player1_name, x.player2_name]), [['A', 'D']]);
});

test('undo is refused while a later-round match has started; byes have nothing to undo', async () => {
  await finishRound0();
  const final = db.matches.find((x) => x.round === 1)!;
  await call(score, ORG, { matchId: final.id, sets: [set(3, 1)], status: 'in_progress' });
  assert.equal((await call(reset, ORG, { matchId: 'm1' })).status, 409);
  assert.equal(db.matches.find((x) => x.id === 'm1')!.status, 'completed');
  // undo the final first, then the earlier result is free
  assert.equal((await call(reset, ORG, { matchId: final.id })).status, 200);
  assert.equal((await call(reset, ORG, { matchId: 'm1' })).status, 200);
  db.matches.push(m('bye', 0, 2, 'E', null, { status: 'completed', winner_name: 'E' }));
  assert.equal((await call(reset, ORG, { matchId: 'bye' })).status, 400);
});

test('delete draw removes one category with its scores; undo puts it back exactly', async () => {
  await finishRound0();
  const before = JSON.stringify([db.matches.filter((x) => x.category === 'ms'), db.match_sets]);
  assert.equal((await call(deleteDraw, COACH, { tournamentId: T, category: 'ms' })).status, 403);
  const del = await call(deleteDraw, ORG, { tournamentId: T, category: 'ms' });
  assert.equal(del.status, 200);
  assert.deepEqual(db.matches.map((x) => x.id), ['other']);
  assert.equal(db.match_sets.length, 0);
  assert.equal((await call(deleteDraw, ORG, { tournamentId: T, category: 'ms' })).status, 404);

  assert.equal((await call(restore, COACH, { tournamentId: T, category: 'ms', ...del.body.deleted })).status, 403);
  const back = await call(restore, ORG, { tournamentId: T, category: 'ms', ...del.body.deleted });
  assert.equal(back.status, 200);
  assert.equal(back.body.restored, 3);
  const after = db.matches.filter((x) => x.category === 'ms');
  assert.deepEqual(after.map((x) => [x.id, x.round, x.position, x.status, x.winner_name]).sort(),
    JSON.parse(before)[0].map((x: any) => [x.id, x.round, x.position, x.status, x.winner_name]).sort());
  assert.equal(db.match_sets.length, JSON.parse(before)[1].length);
  // never on top of a draw made since
  assert.equal((await call(restore, ORG, { tournamentId: T, category: 'ms', ...del.body.deleted })).status, 409);
});

test('restore keeps rows inside the event and category it was asked for', async () => {
  const del = await call(deleteDraw, ORG, { tournamentId: T, category: 'ms' });
  const forged = del.body.deleted.matches.map((x: any) => ({ ...x, tournament_id: 'elsewhere', category: 'ws', bogus: 1 }));
  assert.equal((await call(restore, ORG, { tournamentId: T, category: 'ms', matches: forged, sets: [] })).status, 200);
  const rows = db.matches.filter((x) => ['m1', 'm2'].includes(x.id));
  assert.ok(rows.every((x) => x.tournament_id === T && x.category === 'ms' && !('bogus' in x)));
});
