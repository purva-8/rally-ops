import { createAdminClient } from '@/lib/supabase/admin';
import { categoryFee, categoryLabel, isDoublesCategory } from '@/lib/categories';
import { resolveRecipients } from '@/lib/notify';
import { charges } from '@/lib/billCharges';

type Admin = ReturnType<typeof createAdminClient>;

export type BillLine = { regId: string; person: string; category: string; note: string; amount: number; paid: boolean; pending: boolean; partnerHalf?: boolean };
export type FamilyBill = {
  headId: string; head: string; email: string | null; qid: string | null; mobile: string | null;
  lines: BillLine[]; due: number; paid: number; balance: number; pendingAmount: number;
};

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export type OffPlatformItem = { regId: string; person: string; enteredBy: string; family: string; category: string; amount: number; paid: boolean };

// One bill per family head, from approved entries only, with only that family's own people on it: each person pays
// for themselves (see lib/billCharges). Partners not on the platform are not on any family bill; their halves are
// returned apart so the organizers can collect them on their own.
export async function loadBilling(admin: Admin, tournamentId: string, entryFee: number): Promise<{ bills: FamilyBill[]; offPlatform: OffPlatformItem[] }> {
  const { data: regs } = await admin.from('registrations')
    .select('id, player_id, partner_id, partner_name, category, status, payment_status, partner_paid')
    .eq('tournament_id', tournamentId).eq('status', 'approved');

  const profiles = new Map<string, any>();
  const load = async (ids: string[]) => {
    const todo = ids.filter((i) => i && !profiles.has(i));
    for (const part of chunk(todo, 100)) {
      const { data } = await admin.from('player_profiles').select('id, full_name, parent_id, qid, mobile').in('id', part);
      (data ?? []).forEach((p) => profiles.set(p.id, p));
    }
  };
  await load(Array.from(new Set((regs ?? []).flatMap((r) => [r.player_id, r.partner_id]).filter(Boolean))));
  await load(Array.from(new Set(Array.from(profiles.values()).map((p) => p.parent_id).filter(Boolean))));
  const headOf = (id: string) => profiles.get(id)?.parent_id ?? id;
  const nameOf = (id: string) => (profiles.get(id)?.full_name ?? '').trim();

  const { charges: owed, offPlatform } = charges(
    (regs ?? []).map((r) => ({ ...r, fee: categoryFee(r.category, entryFee) })),
    (a, b) => headOf(a) === headOf(b),
  );

  const families = new Map<string, FamilyBill>();
  for (const c of owed) {
    const hid = headOf(c.personId);
    const head = profiles.get(hid);
    const f: FamilyBill = families.get(hid) ?? { headId: hid, head: head?.full_name ?? '', email: null, qid: head?.qid ?? null, mobile: head?.mobile ?? null, lines: [], due: 0, paid: 0, balance: 0, pendingAmount: 0 };
    const doubles = isDoublesCategory(c.category);
    const partner = c.partnerId ? nameOf(c.partnerId) : (c.partnerName ?? '').trim();
    f.lines.push({
      regId: c.regId, person: nameOf(c.personId), category: categoryLabel(c.category),
      note: doubles ? `${partner ? `with ${partner} · ` : ''}half of ${c.amount * 2}` : '', amount: c.amount, paid: c.paid, pending: false, partnerHalf: c.asPartner,
    });
    f.due += c.amount; if (c.paid) f.paid += c.amount;
    families.set(hid, f);
  }

  const { recipientOf } = await resolveRecipients(admin, Array.from(families.keys()));
  for (const f of families.values()) { f.email = recipientOf.get(f.headId)?.email ?? null; f.balance = f.due - f.paid; }
  return {
    bills: Array.from(families.values()).sort((a, b) => a.head.localeCompare(b.head)),
    offPlatform: offPlatform.map((o) => ({
      regId: o.regId, person: o.partnerName || 'Partner not named', enteredBy: nameOf(o.playerId), family: nameOf(headOf(o.playerId)),
      category: categoryLabel(o.category), amount: o.amount, paid: o.paid,
    })).sort((a, b) => a.family.localeCompare(b.family) || a.person.localeCompare(b.person)),
  };
}

export async function loadBills(admin: Admin, tournamentId: string, entryFee: number): Promise<FamilyBill[]> {
  return (await loadBilling(admin, tournamentId, entryFee)).bills;
}


export type YetItem = { person: string; family: string; category: string; amount: number; why: string };
export type YetToBill = { total: number; pending: YetItem[] };

// Money that will become due but is not on any bill yet: entries waiting for approval. (Halves of partners who are not
// on the platform are listed apart by loadBilling.)
export async function loadYetToBill(admin: Admin, tournamentId: string, entryFee: number): Promise<YetToBill> {
  const { data: regs } = await admin.from('registrations')
    .select('id, player_id, partner_id, partner_name, category, status, payment_status, notes')
    .eq('tournament_id', tournamentId).in('status', ['approved', 'pending']);
  const live = (regs ?? []).filter((r) => r.player_id && r.payment_status !== 'waived');
  const ids = Array.from(new Set(live.flatMap((r) => [r.player_id, r.partner_id]).filter(Boolean)));
  const profiles = new Map<string, any>();
  for (const part of chunk(ids, 100)) {
    const { data } = await admin.from('player_profiles').select('id, full_name, parent_id').in('id', part);
    (data ?? []).forEach((p) => profiles.set(p.id, p));
  }
  const heads = Array.from(new Set(Array.from(profiles.values()).map((p) => p.parent_id).filter(Boolean)));
  for (const part of chunk(heads, 100)) {
    const { data } = await admin.from('player_profiles').select('id, full_name, parent_id').in('id', part);
    (data ?? []).forEach((p) => profiles.set(p.id, p));
  }
  const nameOf = (id: string) => profiles.get(id)?.full_name?.trim() ?? '';
  const familyOf = (id: string) => nameOf(profiles.get(id)?.parent_id ?? id);
  const pending: YetItem[] = [];
  for (const r of live) {
    const fee = categoryFee(r.category, entryFee);
    if (fee <= 0 || r.status !== 'pending') continue;
    const amount = isDoublesCategory(r.category) ? fee / 2 : fee;
    pending.push({ person: nameOf(r.player_id), family: familyOf(r.player_id), category: categoryLabel(r.category), amount, why: 'Waiting for your approval' });
  }
  const total = pending.reduce((s, x) => s + x.amount, 0);
  return { total, pending };
}
