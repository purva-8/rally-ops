// Who owes what, shared by the organizers' bills, the export and the player's own bill. Pure so it can be tested with
// `node --test`. Each person pays for themselves: a singles fee in full, and half a doubles fee for every pair their
// name is on (a pair both partners entered counts once). Which pairs are real is sorted out separately; until then a
// person named in two pairs pays for both. Everyone who plays is billed: people on the
// platform on their family's bill, and people who are not (an entry made at the desk, or a partner typed by name) each
// on a bill of their own.
import { isDoublesCategory } from './categories';

export type ChargeReg = {
  id: string; category: string; player_id: string | null; partner_id: string | null; partner_name: string | null;
  manual_name?: string | null; manual_qid?: string | null;
  payment_status: string | null; partner_paid?: boolean | null; fee: number;
};
// personId is a profile id, or "name:<name>" for someone not on the platform
export type Charge = {
  regId: string; personId: string; personName: string | null; category: string; partnerId: string | null; partnerName: string | null;
  amount: number; paid: boolean; asPartner: boolean; offPlatform: boolean;
};

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
export const offPlatformId = (name: string | null | undefined) => `name:${norm(name)}`;
export const isOffPlatform = (personId: string) => personId.startsWith('name:');

type PairReg = Pick<ChargeReg, 'category' | 'player_id' | 'partner_id' | 'partner_name' | 'manual_name'>;
const playerOf = (r: PairReg) => r.player_id ?? offPlatformId(r.manual_name);
const partnerOf = (r: PairReg) => r.partner_id ?? offPlatformId(r.partner_name);
// The same two people in the same category, whichever of them filed the entry
export const pairOf = (r: PairReg) => `${r.category}|${[playerOf(r), partnerOf(r)].sort().join('|')}`;

export function charges(regs: ChargeReg[], sameFamily: (a: string, b: string) => boolean) {
  const out: Charge[] = [];
  const seen = new Set<string>();
  const live = regs.filter((r) => (r.player_id || r.manual_name?.trim()) && r.fee > 0 && r.payment_status !== 'waived');
  const add = (key: string, c: Charge) => { if (!seen.has(key)) { seen.add(key); out.push(c); } };

  // Own entries first, so a person's half of a pair is booked on their own entry when they have one
  for (const r of live) {
    const doubles = isDoublesCategory(r.category);
    const me = playerOf(r);
    add(doubles && (r.partner_id || r.partner_name?.trim()) ? `${pairOf(r)}|${me}` : `${r.id}|${me}`, {
      regId: r.id, personId: me, personName: r.player_id ? null : (r.manual_name ?? '').trim(), category: r.category,
      partnerId: doubles ? r.partner_id : null, partnerName: doubles ? r.partner_name : null,
      amount: doubles ? r.fee / 2 : r.fee, paid: r.payment_status === 'paid', asPartner: false, offPlatform: !r.player_id,
    });
  }
  for (const r of live) {
    // No partner yet (none linked, none named): only the player is charged until one is added
    if (!isDoublesCategory(r.category) || (!r.partner_id && !r.partner_name?.trim())) continue;
    const partner = partnerOf(r);
    add(`${pairOf(r)}|${partner}`, {
      regId: r.id, personId: partner, personName: r.partner_id ? null : (r.partner_name ?? '').trim(), category: r.category,
      partnerId: r.player_id, partnerName: r.player_id ? null : (r.manual_name ?? '').trim(), amount: r.fee / 2,
      // Halves within one family used to be paid together with the entry
      paid: !!r.partner_paid || (!!r.partner_id && !!r.player_id && sameFamily(r.player_id, r.partner_id) && r.payment_status === 'paid'),
      asPartner: true, offPlatform: !r.partner_id,
    });
  }
  return out;
}
