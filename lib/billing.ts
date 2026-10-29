import { createAdminClient } from '@/lib/supabase/admin';
import { categoryFee, categoryLabel, isDoublesCategory } from '@/lib/categories';
import { resolveRecipients } from '@/lib/notify';
import { charges, isOffPlatform } from '@/lib/billCharges';

type Admin = ReturnType<typeof createAdminClient>;

export type BillLine = { regId: string; person: string; category: string; note: string; amount: number; paid: boolean; pending: boolean; partnerHalf?: boolean; enteredAt?: string };
export type BillPayment = { id: string; received: number; change: number; amount: number; note: string | null; at: string };
export type FamilyBill = {
  headId: string; head: string; email: string | null; qid: string | null; mobile: string | null;
  // paid: cash recorded at the desk (bill_payments); balance below 0 means money is owed back to them
  lines: BillLine[]; due: number; paid: number; balance: number; pendingAmount: number; payments: BillPayment[];
  // newest entry on the bill, for sorting
  latest: string;
  // a person not on the platform, billed under their own name
  offPlatform?: boolean;
};
export type Removal = { id: string; label: string; headId: string | null; at: string };

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// One bill per family head, from approved entries only, with only that family's own people on it: each person pays
// for themselves (see lib/billCharges). People not on the platform (an entry made at the desk, or a partner typed by
// name) each get a bill of their own under their name, so nobody who plays goes unbilled.
// Paid amounts come from the cash recorded at the desk (bill_payments). ledger is false until supabase/bill_payments.sql
// has been run.
export async function loadBilling(admin: Admin, tournamentId: string, entryFee: number): Promise<{ bills: FamilyBill[]; ledger: boolean; removals: Removal[] }> {
  const { data: regs } = await admin.from('registrations')
    .select('id, player_id, partner_id, partner_name, manual_name, manual_email, manual_mobile, manual_qid, category, status, payment_status, partner_paid, created_at')
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
  const headOf = (id: string) => (isOffPlatform(id) ? id : profiles.get(id)?.parent_id ?? id);
  const regById = new Map((regs ?? []).map((r) => [r.id, r]));

  const owed = charges(
    (regs ?? []).map((r) => ({ ...r, fee: categoryFee(r.category, entryFee) })),
    (a, b) => headOf(a) === headOf(b),
  );
  const nameOf = (c: { personId: string; personName: string | null }) => (c.personName ?? profiles.get(c.personId)?.full_name ?? '').trim();

  const families = new Map<string, FamilyBill>();
  for (const c of owed) {
    const hid = headOf(c.personId);
    const head = profiles.get(hid);
    // Someone not on the platform: their own bill; the desk's email and mobile when they entered themselves
    const desk = c.offPlatform && !c.asPartner ? regById.get(c.regId) : null;
    const f: FamilyBill = families.get(hid) ?? {
      headId: hid, head: c.offPlatform ? nameOf(c) : head?.full_name ?? '', email: desk?.manual_email ?? null,
      qid: c.offPlatform ? desk?.manual_qid ?? null : head?.qid ?? null, mobile: c.offPlatform ? desk?.manual_mobile ?? null : head?.mobile ?? null,
      lines: [], due: 0, paid: 0, balance: 0, pendingAmount: 0, payments: [], latest: '', offPlatform: c.offPlatform,
    };
    if (desk) { f.email ??= desk.manual_email ?? null; f.mobile ??= desk.manual_mobile ?? null; f.qid ??= desk.manual_qid ?? null; }
    const doubles = isDoublesCategory(c.category);
    const partner = (c.partnerId ? profiles.get(c.partnerId)?.full_name : c.partnerName ?? '')?.trim();
    f.lines.push({
      regId: c.regId, person: nameOf(c), category: categoryLabel(c.category),
      note: doubles ? `${partner ? `with ${partner} · ` : ''}half of ${c.amount * 2}` : '', amount: c.amount, paid: false, pending: false, partnerHalf: c.asPartner,
      enteredAt: regById.get(c.regId)?.created_at ?? '',
    });
    f.due += c.amount;
    families.set(hid, f);
  }

  // Cash recorded at the desk. A bill whose entries were all removed after paying stays, showing what to give back.
  const { data: pays, error: payErr } = await admin.from('bill_payments')
    .select('id, head_id, head_name, received, change_given, amount, note, created_at, undone_at').eq('tournament_id', tournamentId);
  const ledger = !payErr;
  for (const p of (pays ?? []).filter((x: any) => !x.undone_at).sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))) {
    let f = families.get(p.head_id);
    if (!f) {
      if (!isOffPlatform(p.head_id)) await load([p.head_id]);
      f = { headId: p.head_id, head: profiles.get(p.head_id)?.full_name ?? p.head_name ?? '', email: null, qid: profiles.get(p.head_id)?.qid ?? null,
        mobile: profiles.get(p.head_id)?.mobile ?? null, lines: [], due: 0, paid: 0, balance: 0, pendingAmount: 0, payments: [], latest: '', offPlatform: isOffPlatform(p.head_id) };
      families.set(p.head_id, f);
    }
    const amount = Number(p.amount);
    f.payments.push({ id: p.id, received: Number(p.received), change: Number(p.change_given), amount, note: p.note ?? null, at: p.created_at });
    f.paid += amount;
  }
  const { data: rem } = ledger
    ? await admin.from('bill_removals').select('id, label, head_id, created_at, undone_at').eq('tournament_id', tournamentId)
    : { data: [] };
  const removals = (rem ?? []).filter((r: any) => !r.undone_at)
    .map((r: any) => ({ id: r.id, label: r.label ?? '', headId: r.head_id ?? null, at: r.created_at }))
    .sort((a: Removal, b: Removal) => b.at.localeCompare(a.at));

  const { recipientOf } = await resolveRecipients(admin, Array.from(families.keys()).filter((id) => !isOffPlatform(id)));
  for (const f of families.values()) {
    if (!f.offPlatform) f.email = recipientOf.get(f.headId)?.email ?? null;
    f.paid = Math.round(f.paid * 100) / 100;
    f.balance = Math.round((f.due - f.paid) * 100) / 100;
    // Every line shows as paid once the bill is settled
    for (const l of f.lines) l.paid = f.due > 0 && f.balance <= 0;
    f.latest = f.lines.reduce((m, l) => (l.enteredAt && l.enteredAt > m ? l.enteredAt : m), '');
  }
  const bills = Array.from(families.values()).sort((a, b) => Number(!!a.offPlatform) - Number(!!b.offPlatform) || a.head.localeCompare(b.head));
  return { bills, ledger, removals };
}

// Keeps the per-entry paid flags (shown on the player's own bill and in the export) in step with the desk: a settled
// bill marks its entries paid, anything else marks them unpaid. Own entries use payment_status, a partner's half
// partner_paid.
export async function syncPaidFlags(admin: Admin, bills: FamilyBill[], headIds: string[]) {
  const want = new Set(headIds);
  const groups: Record<string, string[]> = { ownPaid: [], ownUnpaid: [], halfPaid: [], halfUnpaid: [] };
  for (const f of bills.filter((b) => want.has(b.headId))) {
    const settled = f.due > 0 && f.balance <= 0;
    for (const l of f.lines) groups[`${l.partnerHalf ? 'half' : 'own'}${settled ? 'Paid' : 'Unpaid'}`].push(l.regId);
  }
  const run = async (ids: string[], v: Record<string, unknown>) => {
    for (const part of chunk(Array.from(new Set(ids)), 100)) await admin.from('registrations').update(v).in('id', part);
  };
  await run(groups.ownPaid, { payment_status: 'paid' });
  await run(groups.ownUnpaid.filter((id) => !groups.ownPaid.includes(id)), { payment_status: 'unpaid' });
  await run(groups.halfPaid, { partner_paid: true });
  await run(groups.halfUnpaid.filter((id) => !groups.halfPaid.includes(id)), { partner_paid: false });
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
