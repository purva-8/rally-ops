import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventOrganizer } from '@/lib/organizer';
import { loadBilling, loadYetToBill, syncPaidFlags } from '@/lib/billing';
import { pairOf } from '@/lib/billCharges';
import { validCash } from '@/lib/payments';
import { sendMails } from '@/lib/email';
import { billEmail } from '@/lib/emailTemplates';

export const maxDuration = 60;

async function authorize(tournamentId: string | null) {
  if (!tournamentId) return { error: NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 }) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: t } = await supabase.from('tournaments').select('id, name, entry_fee, created_by').eq('id', tournamentId).single();
  if (!t || !(await isEventOrganizer(supabase, t.id, user.id, t.created_by))) return { error: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) };
  return { t, user };
}

export async function GET(req: NextRequest) {
  const a = await authorize(new URL(req.url).searchParams.get('tournamentId'));
  if (a.error) return a.error;
  const admin = createAdminClient();
  const fee = Number(a.t!.entry_fee ?? 0);
  const [{ bills, ledger, removals }, yetToBill] = await Promise.all([loadBilling(admin, a.t!.id, fee), loadYetToBill(admin, a.t!.id, fee)]);
  return NextResponse.json({ bills, ledger, removals, yetToBill });
}

const NEEDS_SQL = 'Recording payments needs a database update first: run supabase/event_day.sql in Supabase';

// Actions (all take tournamentId):
//   email { headIds? }                         no headIds = everyone with a balance
//   pay { headId, received, change, note? }    cash taken at the desk; change = what was handed back
//   markPaid { headIds? }                      records each chosen bill's balance as paid in full
//   undoPayment { paymentId }
//   remove { regId, headId? }                  takes the entry (the whole pair, both forms) off every bill
//   restore { removalId }                      undoes a remove
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const a = await authorize(body.tournamentId ?? null);
  if (a.error) return a.error;
  const admin = createAdminClient();
  const tid = a.t!.id;
  const fee = Number(a.t!.entry_fee ?? 0);
  const { bills: all, ledger } = await loadBilling(admin, tid, fee);
  const ids: string[] | undefined = Array.isArray(body.headIds) && body.headIds.length ? body.headIds : undefined;
  const chosen = all.filter((f) => (ids ? ids.includes(f.headId) : f.balance > 0));
  // After any change to money or entries: reload and bring the paid flags of the touched bills in step
  const resync = async (heads: string[]) => {
    const { bills } = await loadBilling(admin, tid, fee);
    await syncPaidFlags(admin, bills, heads);
  };

  if (body.action === 'pay') {
    if (!ledger) return NextResponse.json({ error: NEEDS_SQL }, { status: 409 });
    const bill = all.find((f) => f.headId === body.headId);
    const received = Number(body.received ?? 0), change = Number(body.change ?? 0);
    if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    if (!validCash(received) || !validCash(change) || (received === 0 && change === 0)) return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 });
    if (received > 0 && change > received) return NextResponse.json({ error: 'Change cannot be more than the cash received' }, { status: 400 });
    // Giving money back (received 0) is only for a bill that has been paid more than it costs
    if (received === 0 && change > -bill.balance) return NextResponse.json({ error: `Only QAR ${Math.max(0, -bill.balance)} is owed back on this bill` }, { status: 400 });
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) || null : null;
    const { data, error } = await admin.from('bill_payments').insert({
      tournament_id: tid, head_id: bill.headId, head_name: bill.head, received, change_given: change, amount: received - change, note, recorded_by: a.user!.id,
    }).select('id').single();
    if (error) { console.error('payment insert failed', error); return NextResponse.json({ error: 'Could not record the payment' }, { status: 500 }); }
    await resync([bill.headId]);
    return NextResponse.json({ ok: true, paymentId: data.id });
  }

  if (body.action === 'markPaid') {
    if (!ledger) return NextResponse.json({ error: NEEDS_SQL }, { status: 409 });
    const owing = chosen.filter((f) => f.balance > 0);
    if (owing.length) {
      const { error } = await admin.from('bill_payments').insert(owing.map((f) => ({
        tournament_id: tid, head_id: f.headId, head_name: f.head, received: f.balance, change_given: 0, amount: f.balance, note: 'Paid in full', recorded_by: a.user!.id,
      })));
      if (error) { console.error('payment insert failed', error); return NextResponse.json({ error: 'Could not record the payments' }, { status: 500 }); }
      await resync(owing.map((f) => f.headId));
    }
    return NextResponse.json({ ok: true, updated: owing.length });
  }

  if (body.action === 'undoPayment') {
    if (!ledger) return NextResponse.json({ error: NEEDS_SQL }, { status: 409 });
    const { data: p } = await admin.from('bill_payments').select('id, head_id, tournament_id, undone_at').eq('id', String(body.paymentId ?? '')).maybeSingle();
    if (!p || p.tournament_id !== tid) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    if (p.undone_at) return NextResponse.json({ ok: true });
    await admin.from('bill_payments').update({ undone_at: new Date().toISOString() }).eq('id', p.id);
    await resync([p.head_id]);
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'remove') {
    if (!ledger) return NextResponse.json({ error: NEEDS_SQL }, { status: 409 });
    const { data: r } = await admin.from('registrations')
      .select('id, tournament_id, category, player_id, partner_id, partner_name, manual_name, status').eq('id', String(body.regId ?? '')).maybeSingle();
    if (!r || r.tournament_id !== tid || r.status !== 'approved') return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    // A pair can have two forms (each partner filed one): both come off, or the other would still bill them
    const { data: sameCat } = await admin.from('registrations')
      .select('id, category, player_id, partner_id, partner_name, manual_name, status').eq('tournament_id', tid).eq('category', r.category).eq('status', 'approved');
    const regIds = r.partner_id || r.partner_name?.trim()
      ? (sameCat ?? []).filter((x: any) => pairOf(x) === pairOf(r)).map((x: any) => x.id)
      : [r.id];
    if (!regIds.includes(r.id)) regIds.push(r.id);
    const touched = all.filter((f) => f.lines.some((l) => regIds.includes(l.regId))).map((f) => f.headId);
    const line = all.flatMap((f) => f.lines).find((l) => l.regId === r.id);
    const label = `${line?.category ?? r.category}${line?.note ? ` · ${line.person} ${line.note.split(' · ')[0]}` : line ? ` · ${line.person}` : ''}`;
    const { error } = await admin.from('registrations').update({ status: 'withdrawn' }).in('id', regIds);
    if (error) { console.error('remove failed', error); return NextResponse.json({ error: 'Could not remove the entry' }, { status: 500 }); }
    const { data: rem } = await admin.from('bill_removals').insert({
      tournament_id: tid, reg_ids: regIds, label, head_id: typeof body.headId === 'string' ? body.headId : null, removed_by: a.user!.id,
    }).select('id').single();
    await resync(touched);
    return NextResponse.json({ ok: true, removalId: rem?.id ?? null, removed: regIds.length });
  }

  if (body.action === 'restore') {
    if (!ledger) return NextResponse.json({ error: NEEDS_SQL }, { status: 409 });
    const { data: rem } = await admin.from('bill_removals').select('id, tournament_id, reg_ids, undone_at').eq('id', String(body.removalId ?? '')).maybeSingle();
    if (!rem || rem.tournament_id !== tid) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (rem.undone_at) return NextResponse.json({ ok: true });
    const { error } = await admin.from('registrations').update({ status: 'approved' }).in('id', rem.reg_ids).eq('status', 'withdrawn');
    if (error) {
      console.error('restore failed', error);
      return NextResponse.json({ error: /duplicate|unique/i.test(error.message ?? '') ? 'This person has been entered in that category again since, so the old entry cannot come back' : 'Could not restore the entry' }, { status: 409 });
    }
    await admin.from('bill_removals').update({ undone_at: new Date().toISOString() }).eq('id', rem.id);
    const { bills } = await loadBilling(admin, tid, fee);
    await syncPaidFlags(admin, bills, bills.filter((f) => f.lines.some((l) => rem.reg_ids.includes(l.regId))).map((f) => f.headId));
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'email') {
    // People not on the platform pay at the desk: their bills are never emailed
    const reachable = chosen.filter((f) => f.email && !f.offPlatform);
    const title = `${a.t!.name} Badminton Tournament`;
    const results = await sendMails(reachable.map((f) => ({
      to: f.email!, kind: 'bill', tournamentId: tid,
      subject: `Your bill for ${title}`,
      html: billEmail({
        name: f.head, tournamentName: title, lines: f.lines, paidSoFar: f.paid,
        paymentNote: 'Please bring the exact amount in cash and pay at the registration desk. If anything on this bill looks wrong, please contact us as soon as possible.',
      }),
    })));
    return NextResponse.json({ ok: true, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, noEmail: chosen.filter((f) => !f.offPlatform && !f.email).length, desk: chosen.filter((f) => f.offPlatform).length });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
