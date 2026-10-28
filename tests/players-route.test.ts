// Changing who plays in a match. Run with: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, session } from './support/fakeSupabase.ts';
import { POST } from '../app/api/tournament/matches/players/route.ts';

const T = 't1', ORG = 'u-org', COORG = 'u-coorg', COACH = 'u-coach';

function call(user: string | null, body: Record<string, unknown>) {
  session.user = user ? { id: user } : null;
  return POST(new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }) as any)
    .then(async (r: Response) => ({ status: r.status, body: await r.json() }));
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.tournaments = [{ id: T, created_by: ORG }];
  db.tournament_staff = [
    { id: 's1', tournament_id: T, user_id: COACH, role: 'coach', status: 'active' },
    { id: 's2', tournament_id: T, user_id: COORG, role: 'admin', status: 'active' },
  ];
  db.player_profiles = [{ id: 'pa' }, { id: 'pz' }];
  db.matches = [
    { id: 'm1', tournament_id: T, category: 'ms', round: 0, position: 0, player1_id: 'pa', player1_name: 'A', player2_id: null, player2_name: 'B', status: 'upcoming' },
    { id: 'bye', tournament_id: T, category: 'ms', round: 0, position: 1, player1_id: null, player1_name: 'C', player2_id: null, player2_name: null, status: 'completed', winner_name: 'C' },
  ];
  db.match_sets = [];
});

const swap = { matchId: 'm1', player1: { id: 'pa', name: 'A' }, player2: { id: 'pz', name: ' Z sub ' } };

test('only organizers and co-organizers can change players', async () => {
  assert.equal((await call(null, swap)).status, 401);
  assert.equal((await call(COACH, swap)).status, 403);
  assert.equal(db.matches[0].player2_name, 'B');
  assert.equal((await call(COORG, swap)).status, 200);
  assert.deepEqual([db.matches[0].player2_id, db.matches[0].player2_name], ['pz', 'Z sub']);
});

test('unknown ids are kept by name only; empty names, byes and started matches are refused', async () => {
  const r = await call(ORG, { matchId: 'm1', player1: { id: 'reg-123', name: 'Typed' }, player2: { name: 'B' } });
  assert.equal(r.status, 200);
  assert.deepEqual([db.matches[0].player1_id, db.matches[0].player1_name], [null, 'Typed']);
  assert.equal((await call(ORG, { matchId: 'm1', player1: { name: ' ' }, player2: { name: 'B' } })).status, 400);
  assert.equal((await call(ORG, { ...swap, matchId: 'bye' })).status, 400);
  db.match_sets.push({ id: 'x', match_id: 'm1', set_number: 1, player1_score: 2, player2_score: 0 });
  assert.equal((await call(ORG, swap)).status, 409);
});
