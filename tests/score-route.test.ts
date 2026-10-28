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

test('the coach of this event can score; the referee staff id is stored as the coach profile', async () => {
  const r = await call(COACH, { matchId: 'm3', sets: [set(0, 0)], status: 'in_progress', courtId: 'court-1', refereeId: 's-coach', refereeName: 'Coach' });
  assert.equal(r.status, 200);
  const row = db.matches.find((x) => x.id === 'm3')!;
  assert.equal(row.referee_id, 'pf-coach');
  assert.equal(row.court_id, 'court-1');
});

test('the server picks the winner from the sets, ignoring a winner sent by the browser', async () => {
  const r = await call(ORG, { matchId: 'm3', sets: [set(15, 21), set(21, 19), set(18, 21)], status: 'completed', winnerId: 'd', winnerName: 'D' });
  assert.equal(r.status, 200);
  assert.equal(r.body.match.winnerId, 'e');
  assert.equal(db.matches.find((x) => x.id === 'm3')!.winner_name, 'E');
});

test('level games, unfinished games and impossible scores cannot complete a match', async () => {
  const r = await call(ORG, { matchId: 'm3', sets: [set(21, 10), set(10, 21)], status: 'completed' });
  assert.equal(r.status, 400);
  assert.equal((await call(ORG, { matchId: 'm3', sets: [set(21, 19)], status: 'completed' })).status, 400);
  assert.equal((await call(ORG, { matchId: 'm3', sets: [set(21, 20), set(21, 3)], status: 'completed' })).status, 400);
  assert.equal((await call(ORG, { matchId: 'm3', sets: [set(25, 3)], status: 'in_progress' })).status, 400);
  assert.equal(db.matches.find((x) => x.id === 'm3')!.status, 'upcoming');
});

test('junk scores and byes are refused', async () => {
  assert.equal((await call(ORG, { matchId: 'm3', sets: [{ player1Score: -3, player2Score: 21 }], status: 'completed' })).status, 400);
  assert.equal((await call(ORG, { matchId: 'm3', sets: 'x' })).status, 400);
  assert.equal((await call(ORG, { matchId: 'm0', sets: [set(21, 0)], status: 'completed' })).status, 400);
});

test('finishing the last first-round match creates the semifinals in slot order, once, in the database', async () => {
  const r = await call(ORG, { matchId: 'm3', sets: [set(21, 5), set(21, 7)], status: 'completed' });
  assert.equal(r.status, 200);
  const semis = db.matches.filter((x) => x.round === 1).sort((a, b) => a.position - b.position);
  // hand-worked: slot0 A vs slot1 B, slot2 C vs slot3 winner D
  assert.deepEqual(semis.map((x) => [x.position, x.player1_id, x.player2_id]), [[0, 'a', 'b'], [1, 'c', 'd']]);
  assert.deepEqual(r.body.nextMatches.map((x: any) => x.roundName), ['Semifinal', 'Semifinal']);
  assert.equal(r.body.match.roundName, 'Quarterfinal');
  // a coach can't change a result the semifinal already uses
  const again = await call(COACH, { matchId: 'm3', sets: [set(5, 21), set(7, 21)], status: 'completed' });
  assert.equal(again.status, 409);
  assert.equal(db.matches.filter((x) => x.round === 1).length, 2);
});

test('an organizer corrects a result after the next round exists: the new winner takes the slot', async () => {
  await call(ORG, { matchId: 'm3', sets: [set(21, 5), set(21, 7)], status: 'completed' });
  const fix = await call(ORG, { matchId: 'm3', sets: [set(5, 21), set(7, 21)], status: 'completed' });
  assert.equal(fix.status, 200);
  const semi = db.matches.find((x) => x.round === 1 && x.position === 1)!;
  assert.deepEqual([semi.player1_id, semi.player2_id, semi.player2_name], ['c', 'e', 'E']);
  assert.deepEqual(fix.body.nextMatches.map((x: any) => x.id), [semi.id]);
  assert.equal(db.matches.filter((x) => x.round === 1).length, 2, 'no extra round made');
  // same winner, different numbers: nothing moves
  assert.equal((await call(ORG, { matchId: 'm3', sets: [set(10, 21), set(7, 21)], status: 'completed' })).status, 200);
  assert.equal(db.matches.find((x) => x.id === semi.id)!.player2_id, 'e');
  // once the semifinal has a score, the earlier result is locked until the semifinal is corrected
  await call(ORG, { matchId: semi.id, sets: [set(3, 1)], status: 'in_progress' });
  const late = await call(ORG, { matchId: 'm3', sets: [set(21, 5), set(21, 7)], status: 'completed' });
  assert.equal(late.status, 409);
  assert.equal(db.matches.find((x) => x.id === semi.id)!.player2_id, 'e');
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

test('semifinals then final then nothing after the final', async () => {
  await call(ORG, { matchId: 'm3', sets: [set(21, 5), set(21, 7)], status: 'completed' });
  const [s0, s1] = db.matches.filter((x) => x.round === 1).sort((a, b) => a.position - b.position);
  await call(ORG, { matchId: s0.id, sets: [set(21, 1), set(21, 1)], status: 'completed' });
  assert.equal(db.matches.filter((x) => x.round === 2).length, 0, 'final waits for both semis');
  const r = await call(COACH, { matchId: s1.id, sets: [set(1, 21), set(1, 21)], status: 'completed' });
  const final = db.matches.filter((x) => x.round === 2);
  assert.deepEqual(final.map((x) => [x.player1_id, x.player2_id]), [['a', 'd']]);
  assert.equal(r.body.nextMatches[0].roundName, 'Final');
  const done = await call(ORG, { matchId: final[0].id, sets: [set(21, 3), set(21, 3)], status: 'completed' });
  assert.equal(done.body.nextMatches.length, 0);
  assert.equal(db.matches.length, 7);
});
