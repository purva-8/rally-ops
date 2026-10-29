// Who owes what. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charges, type ChargeReg } from '../lib/billCharges.ts';

const family: Record<string, string> = { dad: 'dad', son: 'dad', girl: 'dad', mum: 'dad', gopi: 'gopi', sijith: 'sijith', yadu: 'yadu' };
const same = (a: string, b: string) => family[a] === family[b];
const reg = (id: string, player: string, category: string, partner: string | null, partnerName: string | null = null, fee = 60, extra: Partial<ChargeReg> = {}): ChargeReg =>
  ({ id, category, player_id: player, partner_id: partner, partner_name: partnerName, payment_status: 'unpaid', partner_paid: false, fee, ...extra });
const owed = (regs: ChargeReg[]) => {
  const by: Record<string, number> = {};
  for (const x of charges(regs, same)) by[x.personId] = (by[x.personId] ?? 0) + x.amount;
  return { by };
};

test('singles in full; doubles half each; a pair where both entered is charged once', () => {
  const { by } = owed([reg('s', 'dad', 'male_singles_18plus', null, null, 35), reg('a', 'dad', 'mixed_doubles_open', 'son'), reg('b', 'son', 'mixed_doubles_open', 'dad')]);
  assert.deepEqual(by, { dad: 65, son: 30 });
});

test('a parent in Parent + Child with two children pays a half for each pair', () => {
  const { by } = owed([reg('a', 'dad', 'mixed_doubles_open', 'son'), reg('b', 'son', 'mixed_doubles_open', 'dad'), reg('c', 'girl', 'mixed_doubles_open', 'dad')]);
  assert.deepEqual(by, { dad: 60, son: 30, girl: 30 });
});

test('each person is charged only for themselves: a partner in another family pays on their own bill', () => {
  const c = charges([reg('a', 'gopi', 'male_doubles_18plus', 'sijith')], same);
  assert.deepEqual(c.map((x) => [x.personId, x.amount, x.asPartner]), [['gopi', 30, false], ['sijith', 30, true]]);
});

test('everyone who plays is billed: a partner not on the platform pays their half under their own name, not on the family bill', () => {
  const c = charges([reg('a', 'dad', 'male_doubles_18plus', null, 'Ravi K'), reg('b', 'dad', 'spouse_doubles_open', null, ''), reg('c', 'gopi', 'male_doubles_18plus', null, ' ravi  k ')], same);
  const by: Record<string, number> = {};
  for (const x of c) by[x.personId] = (by[x.personId] ?? 0) + x.amount;
  // Ravi K is in two pairs (with dad and with gopi): one bill of his own, a half for each
  assert.deepEqual(by, { dad: 60, gopi: 30, 'name:ravi k': 60, 'name:partner not named': 30 });
  assert.ok(c.filter((x) => x.personId.startsWith('name:')).every((x) => x.offPlatform && x.asPartner));
});

test('an entry made at the desk for someone not on the platform is billed under their name, with their partner', () => {
  const desk = (id: string, name: string, category: string, partnerName: string | null, fee: number): ChargeReg =>
    ({ id, category, player_id: null, partner_id: null, partner_name: partnerName, manual_name: name, payment_status: 'unpaid', partner_paid: false, fee });
  const c = charges([desk('d1', 'Asha', 'female_singles_18plus', null, 35), desk('d2', 'Asha', 'female_doubles_open', 'Meena', 60)], same);
  assert.deepEqual(c.map((x) => [x.personId, x.personName, x.amount]), [['name:asha', 'Asha', 35], ['name:asha', 'Asha', 30], ['name:meena', 'Meena', 30]]);
  // waived (free) entries are still skipped
  assert.equal(charges([desk('d3', 'Test', 'singles_u10', null, 30)].map((r) => ({ ...r, payment_status: 'waived' })), same).length, 0);
});

test('paid flags: own half from the entry, partner half from partner_paid (or the entry, within one family); waived and free skipped', () => {
  const c = charges([
    reg('a', 'dad', 'spouse_doubles_open', 'mum', null, 60, { payment_status: 'paid' }),
    reg('b', 'gopi', 'male_doubles_18plus', 'sijith', null, 60, { partner_paid: true }),
    reg('w', 'yadu', 'male_singles_18plus', null, null, 35, { payment_status: 'waived' }),
    reg('f', 'yadu', 'female_singles_kids', null, null, 0),
  ], same);
  assert.deepEqual(c.map((x) => [x.personId, x.paid]), [['dad', true], ['gopi', false], ['mum', true], ['sijith', true]]);
});
