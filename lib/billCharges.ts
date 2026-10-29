// Who owes what, shared by the organizers' bills and the player's own bill. Pure so it can be tested with `node --test`.
// Each person pays for themselves only: a singles fee in full, and half a doubles fee for each pair they are in, once,
// even when both partners entered. A partner who is not on the platform is on nobody's family bill: their half is
// listed apart, so a family bill only ever has that family's own people on it.
import { isDoublesCategory } from './categories';

export type ChargeReg = {
  id: string; category: string; player_id: string | null; partner_id: string | null; partner_name: string | null;
  payment_status: string | null; partner_paid?: boolean | null; fee: number;
};
export type Charge = { regId: string; personId: string; category: string; partnerId: string | null; partnerName: string | null; amount: number; paid: boolean; asPartner: boolean };
export type OffPlatformHalf = { regId: string; playerId: string; partnerName: string; category: string; amount: number; paid: boolean };

const norm = (s: string | null) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export function charges(regs: ChargeReg[], sameFamily: (a: string, b: string) => boolean) {
  const out: Charge[] = [];
  const offPlatform: OffPlatformHalf[] = [];
  const seen = new Set<string>();
  const live = regs.filter((r) => r.player_id && r.fee > 0 && r.payment_status !== 'waived');
  const pairOf = (r: ChargeReg) => `${r.category}|${[r.player_id, r.partner_id ?? `name:${norm(r.partner_name)}`].sort().join('|')}`;
  const add = (key: string, c: Charge) => { if (!seen.has(key)) { seen.add(key); out.push(c); } };

  // Own entries first, so a person's half is booked on their own entry when they have one
  for (const r of live) {
    const doubles = isDoublesCategory(r.category);
    add(doubles ? `${pairOf(r)}|${r.player_id}` : `${r.id}|${r.player_id}`, {
      regId: r.id, personId: r.player_id!, category: r.category, partnerId: doubles ? r.partner_id : null, partnerName: doubles ? r.partner_name : null,
      amount: doubles ? r.fee / 2 : r.fee, paid: r.payment_status === 'paid', asPartner: false,
    });
  }
  for (const r of live) {
    if (!isDoublesCategory(r.category)) continue;
    const key = `${pairOf(r)}|${r.partner_id ?? 'off'}`;
    if (r.partner_id) {
      add(key, {
        regId: r.id, personId: r.partner_id, category: r.category, partnerId: r.player_id, partnerName: null, amount: r.fee / 2,
        // Halves within one family used to be paid together with the entry
        paid: !!r.partner_paid || (sameFamily(r.player_id!, r.partner_id) && r.payment_status === 'paid'), asPartner: true,
      });
    } else if (!seen.has(key)) {
      seen.add(key);
      offPlatform.push({ regId: r.id, playerId: r.player_id!, partnerName: (r.partner_name ?? '').trim(), category: r.category, amount: r.fee / 2, paid: !!r.partner_paid });
    }
  }
  return { charges: out, offPlatform };
}
