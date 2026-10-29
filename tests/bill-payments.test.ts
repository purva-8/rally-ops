// Cash at the desk: partial payments, change, giving money back, undo, and taking an entry off a bill. Run with: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, session } from './support/fakeSupabase.ts';
import { GET, POST } from '../app/api/tournament/billing/route.ts';
import { changeFor, afterPayment, payState } from '../lib/payments.ts';

const T = 't1', ORG = 'u-org';
const post = (body: Record<string, unknown>, user: string | null = ORG) => {
  session.user = user ? { id: user } : null;
  return POST(new Request('http://x/api', { method: 'POST', body: JSON.stringify({ tournamentId: T, ...body }) }) as any)
    .then(async (r: Response) => ({ status: r.status, body: await r.json() }));
};
const bills = async () => {
  session.user = { id: ORG };
  const r = await GET(new Request(`http://x/api?tournamentId=${T}`) as any);
  return (await r.json()).bills as any[];
};
const bill = async (headId: string) => (await bills()).find((b) => b.headId === headId);
const reg = (id: string, player: string, category: string, partner: string | null = null) =>
  ({ id, tournament_id: T, player_id: player, partner_id: partner, partner_name: null, category, status: 'approved', payment_status: 'unpaid', partner_paid: false, created_at: `2026-10-0${id.length}` });

// Dad's family: dad men's singles (35), dad + son in Parent + Child (60), entered by both: one pair, 30 each.
// Gopi (another family) in men's doubles with dad: dad's half 30. Dad's bill: 35 + 30 + 30 + 30 = 125.
beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.tournaments = [{ id: T, name: 'Cup', created_by: ORG, entry_fee: 60 }];
  db.tournament_staff = [];
  db.player_profiles = [{ id: 'dad', full_name: 'Dad' }, { id: 'son', full_name: 'Son', parent_id: 'dad' }, { id: 'gopi', full_name: 'Gopi' }];
  db.registrations = [
    reg('s', 'dad', 'male_singles_18plus'),
    reg('pc1', 'dad', 'mixed_doubles_open', 'son'), reg('pc2', 'son', 'mixed_doubles_open', 'dad'),
    reg('md', 'gopi', 'male_doubles_18plus', 'dad'),
  ];
  db.bill_payments = [];
  db.bill_removals = [];
});

test('change and status helpers', () => {
  assert.equal(changeFor(180, 200), 20);
  assert.equal(changeFor(180, 150), 0);
  assert.equal(changeFor(-30, 50), 50, 'nothing owed: all of it goes back');
  assert.deepEqual(afterPayment(180, 200, 20), { credited: 180, balance: 0 });
  assert.deepEqual(afterPayment(180, 150, 0), { credited: 150, balance: 30 });
  assert.equal(payState(180, 0), 'due');
  assert.equal(payState(180, 150), 'partial');
  assert.equal(payState(180, 180), 'paid');
  assert.equal(payState(150, 180), 'refund');
});

test('partial payment, then the rest with change: settled, and the entries are marked paid', async () => {
  assert.equal((await bill('dad')).due, 125);
  assert.equal((await post({ action: 'pay', headId: 'dad', received: 100, change: 0 })).status, 200);
  let b = await bill('dad');
  assert.deepEqual([b.paid, b.balance], [100, 25]);
  assert.equal(db.registrations.find((r) => r.id === 's').payment_status, 'unpaid', 'not settled yet');
  // 50 note for the 25 left: 25 change
  await post({ action: 'pay', headId: 'dad', received: 50, change: 25 });
  b = await bill('dad');
  assert.deepEqual([b.paid, b.balance, b.payments.length], [125, 0, 2]);
  assert.ok(b.lines.every((l: any) => l.paid));
  assert.equal(db.registrations.find((r) => r.id === 's').payment_status, 'paid');
  assert.equal(db.registrations.find((r) => r.id === 'md').partner_paid, true, "dad's half of Gopi's pair");
  assert.equal(db.registrations.find((r) => r.id === 'md').payment_status, 'unpaid', "Gopi's own half is his family's");
});

test('undo a payment: the bill is owed again and the entries go back to unpaid', async () => {
  const { body } = await post({ action: 'pay', headId: 'dad', received: 125, change: 0 });
  await post({ action: 'undoPayment', paymentId: body.paymentId });
  const b = await bill('dad');
  assert.deepEqual([b.paid, b.balance, b.payments.length], [0, 125, 0]);
  assert.equal(db.registrations.find((r) => r.id === 's').payment_status, 'unpaid');
  assert.ok(db.bill_payments[0].undone_at, 'kept on record, marked undone');
});

test('remove an entry after paying: the pair goes from both forms, the bill drops, money is owed back; restore undoes it', async () => {
  await post({ action: 'pay', headId: 'dad', received: 125, change: 0 });
  const r = await post({ action: 'remove', regId: 'pc2', headId: 'dad' });
  assert.equal(r.status, 200);
  assert.deepEqual(db.registrations.filter((x) => x.status === 'withdrawn').map((x) => x.id).sort(), ['pc1', 'pc2']);
  let b = await bill('dad');
  assert.deepEqual([b.due, b.paid, b.balance], [65, 125, -60]);
  // Give the 60 back
  assert.equal((await post({ action: 'pay', headId: 'dad', received: 0, change: 70 })).status, 400, 'cannot give back more than owed');
  await post({ action: 'pay', headId: 'dad', received: 0, change: 60 });
  b = await bill('dad');
  assert.deepEqual([b.paid, b.balance], [65, 0]);
  // Restore: the pair is back and 60 is due again
  await post({ action: 'restore', removalId: r.body.removalId });
  b = await bill('dad');
  assert.deepEqual([b.due, b.balance], [125, 60]);
  assert.equal(db.registrations.find((x) => x.id === 'pc1').status, 'approved');
});

test('paid in full records the balance; bad amounts and non-organizers are refused', async () => {
  await post({ action: 'pay', headId: 'dad', received: 50, change: 0 });
  await post({ action: 'markPaid', headIds: ['dad'] });
  const b = await bill('dad');
  assert.deepEqual([b.balance, b.payments.map((p: any) => p.amount)], [0, [50, 75]]);
  assert.equal((await post({ action: 'pay', headId: 'gopi', received: 10, change: 20 })).status, 400);
  assert.equal((await post({ action: 'pay', headId: 'gopi', received: -5, change: 0 })).status, 400);
  assert.equal((await post({ action: 'pay', headId: 'gopi', received: 0, change: 0 })).status, 400);
  assert.equal((await post({ action: 'pay', headId: 'gopi', received: 30, change: 0 }, 'u-stranger')).status, 403);
});
