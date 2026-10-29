// The score route end to end against an in-memory database. Run with: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, session } from './support/fakeSupabase.ts';
import { POST } from '../app/api/tournament/matches/score/route.ts';

const T = 't1', ORG = 'u-org', COACH = 'u-coach', PLAYER = 'u-player', OUTSIDER_STAFF = 'u-other';

function call(user: string | null, body: Record<string, unknown>) {
  session.user = user ? { id: user } : null;
  return POST(new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }) as any)
    .then(async (r: Response) => ({ status: r.status, body: await r.json() }));
}
const set = (a: number, b: number) => ({ player1Score: a, player2Score: b });
const m = (id: string, round: number, position: number, p1: string, p2: string | null, extra: object = {}) =>
  ({ id, tournament_id: T, category: 'ms', round, position, player1_id: p1, player1_name: p1.toUpperCase(), player2_id: p2, player2_name: p2?.toUpperCase() ?? null, status: 'upcoming', created_at: '2026-01-01', ...extra });

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.tournaments = [{ id: T, created_by: ORG }, { id: 't2', created_by: 'someone' }];
  db.tournament_staff = [
    { id: 's-coach', tournament_id: T, user_id: COACH, role: 'coach', status: 'active' },
    { id: 's-other', tournament_id: 't2', user_id: OUTSIDER_STAFF, role: 'admin', status: 'active' },
  ];
  db.player_profiles = [{ id: 'pf-coach', auth_user_id: COACH }];
  // 5 entrants: byes for a, b, c; d plays e. Slots: 0 a(bye) 1 b(bye) 2 c(bye) 3 d-v-e
  db.matches = [
    m('m0', 0, 0, 'a', null, { status: 'completed', winner_id: 'a', winner_name: 'A' }),
    m('m1', 0, 1, 'b', null, { status: 'completed', winner_id: 'b', winner_name: 'B' }),
    m('m2', 0, 2, 'c', null, { status: 'completed', winner_id: 'c', winner_name: 'C' }),
    m('m3', 0, 3, 'd', 'e'),
  ];
  db.match_sets = [];
});

test('anonymous, an ordinary player and staff of another event are refused', async () => {
  assert.equal((await call(null, { matchId: 'm3', sets: [] })).status, 401);
  assert.equal((await call(PLAYER, { matchId: 'm3', sets: [set(21, 0)], status: 'completed' })).status, 403);
  assert.equal((await call(OUTSIDER_STAFF, { matchId: 'm3', sets: [set(21, 0)], status: 'completed' })).status, 403);
  assert.equal(db.matches.find((x) => x.id === 'm3')!.status, 'upcoming');
  assert.equal(db.match_sets.length, 0);
});

test('saving three times keeps exactly the latest sets (no duplicates)', async () => {
  await call(ORG, { matchId: 'm3', sets: [set(0, 0)], status: 'in_progress' });
  await call(ORG, { matchId: 'm3', sets: [set(21, 15)], status: 'in_progress' });
  const r = await call(ORG, { matchId: 'm3', sets: [set(21, 15), set(10, 4)], status: 'in_progress' });
  assert.equal(r.status, 200);
  assert.deepEqual(db.match_sets.map((s) => [s.set_number, s.player1_score, s.player2_score]).sort(), [[1, 21, 15], [2, 10, 4]]);
  assert.deepEqual(r.body.match.sets, [set(21, 15), set(10, 4)]);
});

test('coaches cannot score (only organizers, on the Score desk); a referee staff id is stored as that person\'s profile', async () => {
  assert.equal((await call(COACH, { matchId: 'm3', sets: [set(0, 0)], status: 'in_progress' })).status, 403);
  const r = await call(ORG, { matchId: 'm3', sets: [set(0, 0)], status: 'in_progress', courtId: 'court-1', refereeId: 's-coach', refereeName: 'Coach' });
  assert.equal(r.status, 200);
  const row = db.matches.find((x) => x.id === 'm3')!;
  assert.equal(row.referee_id, 'pf-coach');
  assert.equal(row.court_id, 'court-1');
});

test('the server picks the winner from the sets, ignoring a winner sent by the browser', async () => {
  const r = await call(ORG, { matchId: 'm3', sets: [set(15, 21), set(21, 19), set(12, 21)], status: 'completed', winnerId: 'd', winnerName: 'D' });
  assert.equal(r.status, 200);
  assert.equal(r.body.match.winnerId, 'e');
  assert.equal(db.matches.find((x) => x.id === 'm3')!.winner_name, 'E');
});

test('level games, unfinished games and impossible scores cannot complete a match', async () => {
  const r = await call(ORG, { matchId: 'm3', sets: [set(21, 10), set(10, 21)], status: 'completed' });
  assert.equal(r.status, 400);
  assert.equal((await call(ORG, { matchId: 'm3', sets: [set(21, 19)], status: 'completed' })).status, 400);
  assert.equal((await call(ORG, { matchId: 'm3', sets: [set(20, 18), set(21, 3)], status: 'completed' })).status, 400);
  assert.equal((await call(ORG, { matchId: 'm3', sets: [set(21, 10), set(10, 21), set(15, 3)], status: 'completed' })).status, 400); // game 3 is to 21
  assert.equal((await call(ORG, { matchId: 'm3', sets: [set(25, 3)], status: 'in_progress' })).status, 400);
  assert.equal(db.matches.find((x) => x.id === 'm3')!.status, 'upcoming');
});

test('junk scores and byes are refused', async () => {
  assert.equal((await call(ORG, { matchId: 'm3', sets: [{ player1Score: -3, player2Score: 21 }], status: 'completed' })).status, 400);
  assert.equal((await call(ORG, { matchId: 'm3', sets: 'x' })).status, 400);
  assert.equal((await call(ORG, { matchId: 'm0', sets: [set(21, 0)], status: 'completed' })).status, 400);
});

test('finishing a match draws nothing: next matches are made on the spot', async () => {
  const r = await call(ORG, { matchId: 'm3', sets: [set(21, 5), set(21, 7)], status: 'completed' });
  assert.equal(r.status, 200);
  assert.equal(db.matches.length, 4);
  assert.deepEqual(r.body.nextMatches, []);
  assert.equal(db.matches.find((x) => x.id === 'm3')!.winner_name, 'D');
});

test("a corrected result puts the new winner in the old winner's next match, until that match starts", async () => {
  await call(ORG, { matchId: 'm3', sets: [set(21, 5), set(21, 7)], status: 'completed' });
  // made on the spot after D won: C v D
  db.matches.push(m('next', 1, 0, 'c', 'd', { label: 'Round 2' }), m('unrelated', 1, 1, 'a', 'b', { label: 'Round 2' }));
  const fix = await call(ORG, { matchId: 'm3', sets: [set(5, 21), set(7, 21)], status: 'completed' });
  assert.equal(fix.status, 200);
  const next = db.matches.find((x) => x.id === 'next')!;
  assert.deepEqual([next.player1_id, next.player2_id, next.player2_name], ['c', 'e', 'E']);
  assert.deepEqual(fix.body.nextMatches.map((x: any) => x.id), ['next']);
  assert.deepEqual(fix.body.nextMatches.map((x: any) => x.roundName), ['Round 2'], 'the name it was made with');
  assert.deepEqual(db.matches.find((x) => x.id === 'unrelated')!.player2_name, 'B', 'other matches are not touched');
  // once that match has a score, the earlier result is locked until it is corrected
  await call(ORG, { matchId: 'next', sets: [set(3, 1)], status: 'in_progress' });
  assert.equal((await call(ORG, { matchId: 'm3', sets: [set(21, 5), set(21, 7)], status: 'completed' })).status, 409);
  assert.equal(db.matches.find((x) => x.id === 'm3')!.winner_id, 'e');
});

test('organizers may save a non-standard score; whoever won more games wins. Coaches may not.', async () => {
  assert.equal((await call(COACH, { matchId: 'm3', sets: [set(15, 10)], status: 'completed', override: true })).status, 403);
  assert.equal((await call(ORG, { matchId: 'm3', sets: [set(15, 10), set(10, 15)], status: 'completed', override: true })).status, 400);
  const r = await call(ORG, { matchId: 'm3', sets: [set(15, 10)], status: 'completed', override: true });
  assert.equal(r.status, 200);
  assert.equal(db.matches.find((x) => x.id === 'm3')!.winner_id, 'd');
});

test('a result can be corrected before the next round exists, and a finished match cannot be reopened', async () => {
  db.matches.push(m('m4', 0, 4, 'f', 'g')); // makes round 0 incomplete after m3 finishes
  await call(ORG, { matchId: 'm3', sets: [set(21, 5), set(21, 7)], status: 'completed' });
  const fix = await call(ORG, { matchId: 'm3', sets: [set(5, 21), set(7, 21)], status: 'completed' });
  assert.equal(fix.status, 200);
  assert.equal(db.matches.find((x) => x.id === 'm3')!.winner_id, 'e');
  assert.equal(db.match_sets.filter((s) => s.match_id === 'm3').length, 2);
  assert.equal((await call(ORG, { matchId: 'm3', sets: [set(0, 0)], status: 'in_progress' })).status, 409);
});
