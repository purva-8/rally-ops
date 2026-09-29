import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventOrganizer } from '@/lib/organizer';
import { loadBills } from '@/lib/billing';
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
  const bills = await loadBills(createAdminClient(), a.t!.id, Number(a.t!.entry_fee ?? 0));
  return NextResponse.json({ bills });
}

// { action: 'email' | 'markPaid', tournamentId, headIds?: string[] }  (no headIds = everyone with a balance)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const a = await authorize(body.tournamentId ?? null);
  if (a.error) return a.error;
  const admin = createAdminClient();
  const all = await loadBills(admin, a.t!.id, Number(a.t!.entry_fee ?? 0));
  const ids: string[] | undefined = Array.isArray(body.headIds) && body.headIds.length ? body.headIds : undefined;
  const chosen = all.filter((f) => (ids ? ids.includes(f.headId) : f.balance > 0));

  if (body.action === 'markPaid') {
    const regIds = chosen.flatMap((f) => f.lines.filter((l) => !l.paid).map((l) => l.regId));
    for (let i = 0; i < regIds.length; i += 100) await admin.from('registrations').update({ payment_status: 'paid' }).in('id', regIds.slice(i, i + 100));
    return NextResponse.json({ ok: true, updated: regIds.length });
  }

  if (body.action === 'email') {
    const reachable = chosen.filter((f) => f.email);
    const results = await sendMails(reachable.map((f) => ({
      to: f.email!, kind: 'bill', tournamentId: a.t!.id,
      subject: `Your bill for ${a.t!.name}`,
      html: billEmail({ name: f.head, tournamentName: a.t!.name, lines: f.lines }),
    })));
    return NextResponse.json({ ok: true, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, noEmail: chosen.length - reachable.length });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
