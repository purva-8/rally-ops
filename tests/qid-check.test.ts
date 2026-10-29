// One account per family. Run with: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, session, authUsers } from './support/fakeSupabase.ts';
import { POST } from '../app/api/account/qid-check/route.ts';

const call = (user: string | null, qid: string) => {
  session.user = user ? { id: user } : null;
  return POST(new Request('http://x/api', { method: 'POST', body: JSON.stringify({ qid }) }) as any).then(async (r: Response) => ({ status: r.status, body: await r.json() }));
};

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.player_profiles = [
    { id: 'kunal', auth_user_id: 'u-abhi', parent_id: null, qid: '28035643049' },
    { id: 'son', auth_user_id: null, parent_id: 'kunal', qid: '28035643049' },
  ];
  authUsers['u-abhi'] = 'abhi.sdabi@gmail.com';
});

test('a Qatar ID another account holds is taken, with a masked email', async () => {
  const r = await call('u-ak', '28035643049');
  assert.deepEqual(r.body, { taken: true, hint: 'ab***@gmail.com' });
});

test('your own Qatar ID, a family member sharing it, or a new one is fine', async () => {
  assert.equal((await call('u-abhi', '28035643049')).body.taken, false);
  assert.equal((await call('u-new', '29999999999')).body.taken, false);
  db.player_profiles = [{ id: 'son', auth_user_id: null, parent_id: 'kunal', qid: '28035643049' }];
  assert.equal((await call('u-new', '28035643049')).body.taken, false);
  assert.equal((await call(null, '28035643049')).status, 401);
});
