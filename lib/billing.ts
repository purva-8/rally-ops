import { createAdminClient } from '@/lib/supabase/admin';
import { categoryFee, categoryLabel, isDoublesCategory } from '@/lib/categories';
import { resolveRecipients } from '@/lib/notify';

type Admin = ReturnType<typeof createAdminClient>;

export type BillLine = { regId: string; person: string; category: string; note: string; amount: number; paid: boolean; pending: boolean };
export type FamilyBill = {
  headId: string; head: string; email: string | null; qid: string | null; mobile: string | null;
  lines: BillLine[]; due: number; paid: number; balance: number; pendingAmount: number;
};

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// One bill per household, from approved entries only. A doubles fee is per pair: each partner's own entry carries half,
// unless both partners are in the same household (then it is paid together, in full).
export async function loadBills(admin: Admin, tournamentId: string, entryFee: number): Promise<FamilyBill[]> {
  const { data: regs } = await admin.from('registrations')
    .select('id, player_id, partner_id, partner_name, category, status, payment_status')
    .eq('tournament_id', tournamentId).eq('status', 'approved');
  const live = (regs ?? []).filter((r) => r.player_id && r.payment_status !== 'waived');

  const profiles = new Map<string, any>();
  const load = async (ids: string[]) => {
    const todo = ids.filter((i) => i && !profiles.has(i));
    for (const part of chunk(todo, 100)) {
      const { data } = await admin.from('player_profiles').select('id, full_name, parent_id, qid, mobile').in('id', part);
      (data ?? []).forEach((p) => profiles.set(p.id, p));
    }
  };
  await load(Array.from(new Set(live.flatMap((r) => [r.player_id, r.partner_id]).filter(Boolean))));
  await load(Array.from(new Set(Array.from(profiles.values()).map((p) => p.parent_id).filter(Boolean))));
  const headOf = (id: string) => profiles.get(id)?.parent_id ?? id;

  const families = new Map<string, FamilyBill>();
  for (const r of live) {
    const fee = categoryFee(r.category, entryFee);
    if (fee <= 0) continue;
    const doubles = isDoublesCategory(r.category);
    const amount = doubles ? fee / 2 : fee;
    const hid = headOf(r.player_id);
    const head = profiles.get(hid);
    const f: FamilyBill = families.get(hid) ?? { headId: hid, head: head?.full_name ?? '', email: null, qid: head?.qid ?? null, mobile: head?.mobile ?? null, lines: [], due: 0, paid: 0, balance: 0, pendingAmount: 0 };
    const partner = r.partner_id ? profiles.get(r.partner_id)?.full_name : r.partner_name;
    const paid = r.payment_status === 'paid';
    const pending = r.status === 'pending';
    f.lines.push({
      regId: r.id, person: profiles.get(r.player_id)?.full_name ?? '', category: categoryLabel(r.category),
      note: doubles ? `${partner ? `with ${partner} · ` : ''}half of ${fee}` : '', amount, paid, pending,
    });
    f.due += amount; if (paid) f.paid += amount; if (pending) f.pendingAmount += amount;
    const partnerFiled = !!r.partner_id && live.some((o) => o.id !== r.id && o.player_id === r.partner_id && o.category === r.category);
    if (doubles && r.partner_id && headOf(r.partner_id) === hid && !partnerFiled) {
      f.lines.push({ regId: r.id, person: profiles.get(r.partner_id)?.full_name ?? '', category: categoryLabel(r.category), note: `with ${profiles.get(r.player_id)?.full_name ?? 'partner'} · half of ${fee}`, amount, paid, pending });
      f.due += amount; if (paid) f.paid += amount; if (pending) f.pendingAmount += amount;
    }
    families.set(hid, f);
  }

  const { recipientOf } = await resolveRecipients(admin, Array.from(families.keys()));
  for (const f of families.values()) { f.email = recipientOf.get(f.headId)?.email ?? null; f.balance = f.due - f.paid; }
  return Array.from(families.values()).sort((a, b) => a.head.localeCompare(b.head));
}


export type YetItem = { person: string; family: string; category: string; amount: number; why: string };
export type YetToBill = { total: number; pending: YetItem[]; partners: YetItem[] };

// Money that will become due but is not on any bill yet: entries waiting for approval, and the other half of
// doubles whose partner has not entered yet (or was never linked).
export async function loadYetToBill(admin: Admin, tournamentId: string, entryFee: number): Promise<YetToBill> {
  const { data: regs } = await admin.from('registrations')
    .select('id, player_id, partner_id, partner_name, category, status, payment_status')
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
  const has = (pid: string, cat: string, status: string) => live.some((o) => o.player_id === pid && o.category === cat && o.status === status);

  const pending: YetItem[] = [];
  const partners: YetItem[] = [];
  for (const r of live) {
    const fee = categoryFee(r.category, entryFee);
    if (fee <= 0) continue;
    const doubles = isDoublesCategory(r.category);
    const amount = doubles ? fee / 2 : fee;
    if (r.status === 'pending') {
      pending.push({ person: nameOf(r.player_id), family: familyOf(r.player_id), category: categoryLabel(r.category), amount, why: 'Waiting for your approval' });
      continue;
    }
    if (!doubles) continue;
    if (r.partner_id) {
      const sameHome = (profiles.get(r.partner_id)?.parent_id ?? r.partner_id) === (profiles.get(r.player_id)?.parent_id ?? r.player_id);
      if (sameHome || has(r.partner_id, r.category, 'approved') || has(r.partner_id, r.category, 'pending')) continue; // already on a bill, or counted above
      partners.push({ person: nameOf(r.partner_id), family: familyOf(r.partner_id), category: categoryLabel(r.category), amount, why: `${nameOf(r.player_id)} entered with them. Billed once ${nameOf(r.partner_id).split(' ')[0]} enters` });
    } else {
      partners.push({ person: r.partner_name || 'Partner not named', family: '', category: categoryLabel(r.category), amount, why: `${nameOf(r.player_id)} entered. Partner not linked yet` });
    }
  }
  const total = [...pending, ...partners].reduce((s, x) => s + x.amount, 0);
  return { total, pending, partners };
}
