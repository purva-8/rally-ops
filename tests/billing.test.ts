// Who owes what. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charges, type ChargeReg } from '../lib/billCharges.ts';

const family: Record<string, string> = { dad: 'dad', son: 'dad', girl: 'dad', mum: 'dad', gopi: 'gopi', sijith: 'sijith', yadu: 'yadu' };
const same = (a: string, b: string) => family[a] === family[b];
const reg = (id: string, player: string, category: string, partner: string | null, partnerName: string | null = null, fee = 60, extra: Partial<ChargeReg> = {}): ChargeReg =>
  ({ id, category, player_id: player, partner_id: partner, partner_name: partnerName, payment_status: 'unpaid', partner_paid: false, fee, ...extra });
const owed = (regs: ChargeReg[]) => {
  const { charges: c, offPlatform } = charges(regs, same);
  const by: Record<string, number> = {};
  for (const x of c) by[x.personId] = (by[x.personId] ?? 0) + x.amount;
  return { by, offPlatform };
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
  const { charges: c } = charges([reg('a', 'gopi', 'male_doubles_18plus', 'sijith')], same);
  assert.deepEqual(c.map((x) => [x.personId, x.amount, x.asPartner]), [['gopi', 30, false], ['sijith', 30, true]]);
});

test('a partner not on the platform is on no family bill: their half is listed apart, once per pair', () => {
  const { by, offPlatform } = owed([reg('a', 'dad', 'male_doubles_18plus', null, 'Ravi K'), reg('b', 'dad', 'spouse_doubles_open', null, '')]);
  assert.deepEqual(by, { dad: 60 });
  assert.deepEqual(offPlatform.map((o) => [o.regId, o.partnerName, o.amount]), [['a', 'Ravi K', 30], ['b', '', 30]]);
});

test('paid flags: own half from the entry, partner half from partner_paid (or the entry, within one family); waived and free skipped', () => {
  const { charges: c } = charges([
    reg('a', 'dad', 'spouse_doubles_open', 'mum', null, 60, { payment_status: 'paid' }),
    reg('b', 'gopi', 'male_doubles_18plus', 'sijith', null, 60, { partner_paid: true }),
    reg('w', 'yadu', 'male_singles_18plus', null, null, 35, { payment_status: 'waived' }),
    reg('f', 'yadu', 'female_singles_kids', null, null, 0),
  ], same);
  assert.deepEqual(c.map((x) => [x.personId, x.paid]), [['dad', true], ['gopi', false], ['mum', true], ['sijith', true]]);
});
