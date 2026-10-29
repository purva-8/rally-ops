// Organizers registering an app profile on the spot. Run with: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, session } from './support/fakeSupabase.ts';
import { POST } from '../app/api/tournament/registrations/add/route.ts';

const T = 't1', ORG = 'u-org', PLAYER = 'u-player';
function call(user: string | null, body: Record<string, unknown>) {
  session.user = user ? { id: user } : null;
  return POST(new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }) as any)
    .then(async (r: Response) => ({ status: r.status, body: await r.json() }));
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.tournaments = [{ id: T, created_by: ORG, categories: ['male_singles_18plus', 'male_doubles_18plus'], entry_fee: 50 }];
  db.tournament_staff = [];
  db.player_profiles = [{ id: 'pa', full_name: 'Anil' }, { id: 'pb', full_name: 'Bala' }];
  db.registrations = [];
});

test('an organizer adds a profile: approved, unpaid when the category has a fee', async () => {
  const r = await call(ORG, { tournamentId: T, category: 'male_singles_18plus', playerId: 'pa' });
  assert.equal(r.status, 200);
  assert.equal(db.registrations.length, 1);
  assert.equal(db.registrations[0].status, 'approved');
  assert.equal(db.registrations[0].player_id, 'pa');
  assert.equal(db.registrations[0].partner_name, null);
  assert.ok(['unpaid', 'waived'].includes(db.registrations[0].payment_status));
});

test('doubles: partner from the app is linked by id, or a typed name is kept', async () => {
  await call(ORG, { tournamentId: T, category: 'male_doubles_18plus', playerId: 'pa', partnerId: 'pb' });
  assert.deepEqual([db.registrations[0].partner_id, db.registrations[0].partner_name], ['pb', 'Bala']);
  await call(ORG, { tournamentId: T, category: 'male_doubles_18plus', playerId: 'pb', partnerName: ' Ravi ' });
  assert.deepEqual([db.registrations[1].partner_id, db.registrations[1].partner_name], [null, 'Ravi']);
});

test('no duplicates, no unknown category or profile, organizers only', async () => {
  await call(ORG, { tournamentId: T, category: 'male_singles_18plus', playerId: 'pa' });
  assert.equal((await call(ORG, { tournamentId: T, category: 'male_singles_18plus', playerId: 'pa' })).status, 409);
  db.registrations[0].status = 'withdrawn';
  assert.equal((await call(ORG, { tournamentId: T, category: 'male_singles_18plus', playerId: 'pa' })).status, 200, 'a withdrawn entry can be re-added');
  assert.equal((await call(ORG, { tournamentId: T, category: 'female_singles_18plus', playerId: 'pa' })).status, 400);
  assert.equal((await call(ORG, { tournamentId: T, category: 'male_singles_18plus', playerId: 'nobody' })).status, 404);
  assert.equal((await call(PLAYER, { tournamentId: T, category: 'male_singles_18plus', playerId: 'pb' })).status, 403);
  assert.equal((await call(null, { tournamentId: T, category: 'male_singles_18plus', playerId: 'pb' })).status, 401);
});
