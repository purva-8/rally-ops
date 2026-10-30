// Match day safety: two desks on one match, every change in the history, restore of any change, backups.
// Run with: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, session } from './support/fakeSupabase.ts';
import { POST as score } from '../app/api/tournament/matches/score/route.ts';
import { POST as reset } from '../app/api/tournament/matches/reset/route.ts';
import { POST as make, DELETE as unmake } from '../app/api/tournament/matches/quick/route.ts';
import { GET as history, POST as restore } from '../app/api/tournament/matches/history/route.ts';
import { GET as backup } from '../app/api/tournament/backup/route.ts';
import { POST as courtStart } from '../app/api/tournament/matches/court/route.ts';

const T = 't1', ORG = 'u-org';
const call = (fn: (r: any) => Promise<Response>, body: Record<string, unknown>, user: string | null = ORG) => {
  session.user = user ? { id: user } : null;
  return fn(new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }) as any)
    .then(async (r: Response) => ({ status: r.status, body: await r.json() }));
};
const get = (fn: (r: any) => Promise<Response>, qs: string, user: string | null = ORG) => {
  session.user = user ? { id: user } : null;
  return fn(new Request(`http://x/api?${qs}`) as any);
};
const g = (a: number, b: number) => ({ player1Score: a, player2Score: b });
const A_WINS = [g(21, 5), g(21, 7)], B_WINS = [g(5, 21), g(7, 21)];
const log = async () => (await (await get(history, `tournamentId=${T}`)).json()).entries as any[];
const m = (id: string, p1: string, p2: string) => ({ id, tournament_id: T, category: 'ms', round: 0, position: id.length, player1_id: null, player1_name: p1, player2_id: null, player2_name: p2, status: 'upcoming', created_at: '2026-10-30' });

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.tournaments = [{ id: T, created_by: ORG, name: 'Cup' }];
  db.tournament_staff = [];
  db.player_profiles = [];
  db.registrations = [{ id: 'r1', tournament_id: T, player_id: null, manual_name: 'A', category: 'ms', status: 'approved' }];
  db.matches = [m('m1', 'A', 'B')];
  db.match_sets = [];
  db.match_log = [];
});

test('two desks: a save based on an old view is refused, nothing is overwritten, and "save mine anyway" works', async () => {
  // desk 1 saves A winning
  assert.equal((await call(score, { matchId: 'm1', sets: A_WINS, status: 'completed', expected: { status: 'upcoming', sets: [] } })).status, 200);
  // desk 2 still thinks the match is empty and saves B winning
  const clash = await call(score, { matchId: 'm1', sets: B_WINS, status: 'completed', expected: { status: 'upcoming', sets: [] } });
  assert.equal(clash.status, 409);
  assert.equal(clash.body.conflict, true);
  assert.deepEqual(clash.body.current.sets, A_WINS);
  assert.equal(db.matches[0].winner_name, 'A', 'desk 1 result kept');
  // desk 2 decides theirs is right
  assert.equal((await call(score, { matchId: 'm1', sets: B_WINS, status: 'completed', expected: { status: 'upcoming', sets: [] }, force: true })).status, 200);
  assert.equal(db.matches[0].winner_name, 'B');
  // a desk that saw the latest saves without trouble
  assert.equal((await call(score, { matchId: 'm1', sets: A_WINS, status: 'completed', expected: { status: 'completed', sets: B_WINS } })).status, 200);
});

test('the same save sent twice (reply lost on a weak connection) is accepted once, not called a clash', async () => {
  const save = { matchId: 'm1', sets: A_WINS, status: 'completed', expected: { status: 'upcoming', sets: [] } };
  assert.equal((await call(score, save)).status, 200);
  const again = await call(score, save);
  assert.equal(again.status, 200);
  assert.equal(again.body.alreadySaved, true);
  assert.equal(again.body.match.winnerName, 'A');
  assert.equal((await log()).filter((e) => e.action === 'score').length, 1, 'one history entry, not two');
});

test('every change is in the history, and only organizers can see it', async () => {
  await call(score, { matchId: 'm1', sets: A_WINS, status: 'completed' });
  await call(reset, { matchId: 'm1' });
  await call(make, { tournamentId: T, category: 'ms', pairs: [{ player1: { name: 'C' }, player2: { name: 'D' } }] });
  const made = db.matches.find((x) => x.player1_name === 'C')!;
  await call(unmake, { tournamentId: T, matchId: made.id });
  const entries = await log();
  assert.deepEqual(entries.map((e) => e.action).sort(), ['create', 'delete', 'reset', 'score']);
  assert.ok(entries.find((e) => e.action === 'score').summary.includes('A won 21-5, 21-7'));
  assert.equal((await get(history, `tournamentId=${T}`, 'u-stranger')).status, 403);
});

test('restore an undone result: the score and winner come back', async () => {
  await call(score, { matchId: 'm1', sets: A_WINS, status: 'completed' });
  await call(reset, { matchId: 'm1' });
  assert.equal(db.matches[0].status, 'upcoming');
  const undo = (await log()).find((e) => e.action === 'reset');
  const r = await call(restore, { tournamentId: T, logId: undo.id });
  assert.equal(r.status, 200);
  assert.deepEqual([db.matches[0].status, db.matches[0].winner_name], ['completed', 'A']);
  assert.deepEqual(db.match_sets.map((x) => [x.player1_score, x.player2_score]), [[21, 5], [21, 7]]);
  // the restore is in the history too, and can itself be put back
  const again = (await log()).find((e) => e.action === 'restore');
  assert.equal((await call(restore, { tournamentId: T, logId: again.id })).status, 200);
  assert.equal(db.matches[0].status, 'upcoming');
});

test('restore a wrong correction, a taken-back match, and a match made by mistake', async () => {
  await call(score, { matchId: 'm1', sets: A_WINS, status: 'completed' });
  await call(score, { matchId: 'm1', sets: B_WINS, status: 'completed' });
  const fix = (await log()).find((e) => e.action === 'score' && e.summary.includes('was A'));
  await call(restore, { tournamentId: T, logId: fix.id });
  assert.equal(db.matches[0].winner_name, 'A');

  await call(make, { tournamentId: T, category: 'ms', pairs: [{ player1: { name: 'C' }, player2: { name: 'D' } }] });
  const made = db.matches.find((x) => x.player1_name === 'C')!;
  await call(unmake, { tournamentId: T, matchId: made.id });
  const gone = (await log()).find((e) => e.action === 'delete');
  assert.equal((await call(restore, { tournamentId: T, logId: gone.id })).status, 200);
  assert.ok(db.matches.find((x) => x.id === made.id), 'same match back, same id');

  const create = (await log()).find((e) => e.action === 'create');
  assert.equal((await call(restore, { tournamentId: T, logId: create.id })).status, 200);
  assert.equal(db.matches.find((x) => x.id === made.id), undefined, 'made by mistake: removed again');
});

test('restore never breaks a later match or puts someone in two matches', async () => {
  await call(score, { matchId: 'm1', sets: A_WINS, status: 'completed' });
  // A is now in a later match
  await call(make, { tournamentId: T, category: 'ms', pairs: [{ player1: { name: 'A' }, player2: { name: 'E' } }] });
  const first = (await log()).find((e) => e.action === 'score');
  const r = await call(restore, { tournamentId: T, logId: first.id });
  assert.equal(r.status, 409, 'putting m1 back to unplayed would pull A out from under the later match');
  assert.equal(db.matches[0].winner_name, 'A');
  // a taken-back match can't come back while one of its players is in another match
  const later = db.matches.find((x) => x.player2_name === 'E')!;
  await call(unmake, { tournamentId: T, matchId: later.id });
  await call(make, { tournamentId: T, category: 'ms', pairs: [{ player1: { name: 'E' }, player2: { name: 'F' } }] });
  const gone = (await log()).find((e) => e.action === 'delete');
  assert.equal((await call(restore, { tournamentId: T, logId: gone.id })).status, 409);
});

test('backup has every table for the event and is organizers only', async () => {
  await call(score, { matchId: 'm1', sets: A_WINS, status: 'completed' });
  const res = await get(backup, `tournamentId=${T}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition') ?? '', /rallyops-backup-/);
  const b = await res.json();
  assert.equal(b.registrations.length, 1);
  assert.equal(b.matches.length, 1);
  assert.equal(b.match_sets.length, 2);
  assert.equal(b.match_log.length, 1);
  assert.equal((await get(backup, `tournamentId=${T}`, 'u-stranger')).status, 403);
});

test('court 6-9 and match started: saved, refused when wrong, in the history, scores untouched', async () => {
  assert.equal((await call(courtStart, { matchId: 'm1', court: '7' })).status, 200);
  assert.equal(db.matches[0].court_id, 'court-7');
  assert.equal((await call(courtStart, { matchId: 'm1', court: '3' })).status, 400, 'only courts 6-9');
  assert.equal((await call(courtStart, { matchId: 'm1', started: true }, null)).status, 401);
  const r = await call(courtStart, { matchId: 'm1', started: true });
  assert.equal(r.status, 200);
  assert.equal(db.matches[0].status, 'in_progress');
  assert.equal(r.body.match.courtId, 'court-7');
  // taken back while no score is in
  assert.equal((await call(courtStart, { matchId: 'm1', started: false })).status, 200);
  assert.equal(db.matches[0].status, 'upcoming');
  // once a score is in, "not started" is refused: Undo clears it instead
  await call(score, { matchId: 'm1', sets: [g(5, 3)], status: 'in_progress' });
  assert.equal((await call(courtStart, { matchId: 'm1', started: false })).status, 409);
  assert.deepEqual(db.match_sets.map((x) => [x.player1_score, x.player2_score]), [[5, 3]], 'scores untouched');
  // a finished match cannot be started again
  await call(score, { matchId: 'm1', sets: A_WINS, status: 'completed' });
  assert.equal((await call(courtStart, { matchId: 'm1', started: true })).status, 409);
  const actions = (await log()).map((e) => e.action);
  assert.ok(actions.includes('court') && actions.includes('start'));
});
