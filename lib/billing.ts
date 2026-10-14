import { createAdminClient } from '@/lib/supabase/admin';
import { categoryFee, categoryLabel, isDoublesCategory } from '@/lib/categories';
import { resolveRecipients } from '@/lib/notify';

type Admin = ReturnType<typeof createAdminClient>;

export type BillLine = { regId: string; person: string; category: string; note: string; amount: number; paid: boolean; pending: boolean; partnerHalf?: boolean };
export type FamilyBill = {
  headId: string; head: string; email: string | null; qid: string | null; mobile: string | null;
  lines: BillLine[]; due: number; paid: number; balance: number; pendingAmount: number;
};

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// One bill per household, from approved entries only. A doubles fee is per pair: each partner's own entry carries half,
// unless both partners are in the same household (then it is paid together, in full).
export async function loadBills(admin: Admin, tournamentId: string, entryFee: number): Promise<FamilyBill[]> {
  const { data: regs } = await admin.from('registrations')
    .select('id, player_id, partner_id, partner_name, category, status, payment_status, partner_paid, notes')
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
  const addLine = (hid: string, line: BillLine) => {
    const head = profiles.get(hid);
    const f: FamilyBill = families.get(hid) ?? { headId: hid, head: head?.full_name ?? '', email: null, qid: head?.qid ?? null, mobile: head?.mobile ?? null, lines: [], due: 0, paid: 0, balance: 0, pendingAmount: 0 };
    f.lines.push(line);
    f.due += line.amount; if (line.paid) f.paid += line.amount;
    families.set(hid, f);
  };
  for (const r of live) {
    const fee = categoryFee(r.category, entryFee);
    if (fee <= 0) continue;
    const doubles = isDoublesCategory(r.category);
    const amount = doubles ? fee / 2 : fee;
    const hid = headOf(r.player_id);
    const partner = r.partner_id ? profiles.get(r.partner_id)?.full_name : r.partner_name;
    const paid = r.payment_status === 'paid';
    const me = profiles.get(r.player_id)?.full_name ?? '';
    addLine(hid, {
      regId: r.id, person: me, category: categoryLabel(r.category),
      note: doubles ? `${partner ? `with ${partner} · ` : ''}half of ${fee}` : '', amount, paid, pending: false,
    });
    if (!doubles) continue;
    const partnerFiled = !!r.partner_id && live.some((o) => o.id !== r.id && o.player_id === r.partner_id && o.category === r.category);
    if (r.partner_id && !partnerFiled) {
      // The partner has no entry of their own: their half is billed to their own family (paid on its own, tracked as partner_paid),
      // or together with this entry when they are in the same family
      const phid = headOf(r.partner_id);
      addLine(phid, {
        regId: r.id, person: profiles.get(r.partner_id)?.full_name ?? '', category: categoryLabel(r.category),
        note: `with ${me} · half of ${fee}`, amount, paid: phid === hid ? paid : !!r.partner_paid, pending: false, partnerHalf: phid !== hid,
      });
    } else if (!r.partner_id && String(r.notes ?? '').split('|').map((x: string) => x.trim()).includes('PAIRED')) {
      // Partner confirmed as typed and not on the portal: whoever entered handles the other half too
      addLine(hid, { regId: r.id, person: r.partner_name || 'Partner', category: categoryLabel(r.category), note: `with ${me} · half of ${fee} (partner not on the portal)`, amount, paid, pending: false });
    }
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
    // Linked partners are billed on their family's bill now; only a partner nobody has named or confirmed is still unbilled
    if (!r.partner_id && !String((r as any).notes ?? '').split('|').map((x: string) => x.trim()).includes('PAIRED')) {
      partners.push({ person: r.partner_name || 'Partner not named', family: '', category: categoryLabel(r.category), amount, why: `${nameOf(r.player_id)} entered. Partner not linked yet` });
    }
  }
  const total = [...pending, ...partners].reduce((s, x) => s + x.amount, 0);
  return { total, pending, partners };
}
