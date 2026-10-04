import { NextResponse } from 'next/server';
import { getDevUser } from '@/lib/devAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

// Things that need a human: remarks players left on entries, and emails that failed to send
export async function GET() {
  if (!(await getDevUser())) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const admin = createAdminClient();

  const { data: regs } = await admin.from('registrations')
    .select('id, player_id, category, status, notes, created_at, partner_name')
    .not('notes', 'is', null).neq('status', 'withdrawn').order('created_at', { ascending: false });
  const withRemark = (regs ?? []).map((r) => {
    const remark = (r.notes ?? '').split('|').map((x: string) => x.trim()).filter((x: string) => x && x !== 'VOLUNTEER' && x.toUpperCase() !== 'N/A').join(' | ');
    return { ...r, remark };
  }).filter((r) => r.remark);

  const ids = Array.from(new Set(withRemark.map((r) => r.player_id).filter(Boolean)));
  const { data: people } = ids.length ? await admin.from('player_profiles').select('id, full_name, mobile, parent_id').in('id', ids) : { data: [] as any[] };
  const heads = Array.from(new Set((people ?? []).map((p) => p.parent_id).filter(Boolean)));
  const { data: headRows } = heads.length ? await admin.from('player_profiles').select('id, full_name, mobile').in('id', heads) : { data: [] as any[] };
  const by = new Map([...(people ?? []), ...(headRows ?? [])].map((p) => [p.id, p]));
  const remarks = withRemark.map((r) => {
    const p = by.get(r.player_id); const head = p?.parent_id ? by.get(p.parent_id) : p;
    return { id: r.id, at: r.created_at, name: p?.full_name ?? '', account: head?.full_name ?? '', mobile: head?.mobile ?? p?.mobile ?? '', category: r.category, status: r.status, remark: r.remark };
  });

  const { data: failed } = await admin.from('email_log').select('id, created_at, kind, to_email, subject, status, error')
    .eq('status', 'failed').order('created_at', { ascending: false }).limit(30);

  return NextResponse.json({ remarks, failedEmails: failed ?? [] });
}
