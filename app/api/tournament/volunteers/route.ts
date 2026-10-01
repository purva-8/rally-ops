import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventOrganizer } from '@/lib/organizer';

// People who ticked "I would like to volunteer", with a number to reach them on (their own, or their family's)
export async function GET(req: NextRequest) {
  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: t } = await supabase.from('tournaments').select('id, created_by').eq('id', tournamentId).single();
  if (!t || !(await isEventOrganizer(supabase, t.id, user.id, t.created_by))) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const admin = createAdminClient();
  const { data: regs } = await admin.from('registrations')
    .select('player_id, notes, status, created_at, manual_name, manual_mobile')
    .eq('tournament_id', tournamentId).like('notes', '%VOLUNTEER%').neq('status', 'withdrawn').order('created_at');

  const ids = Array.from(new Set((regs ?? []).map((r) => r.player_id).filter(Boolean)));
  const people = new Map<string, any>();
  const load = async (list: string[]) => {
    const todo = list.filter((i) => !people.has(i));
    for (let i = 0; i < todo.length; i += 100) {
      const { data } = await admin.from('player_profiles').select('id, full_name, mobile, parent_id, auth_user_id').in('id', todo.slice(i, i + 100));
      (data ?? []).forEach((p) => people.set(p.id, p));
    }
  };
  await load(ids);
  await load(Array.from(new Set(Array.from(people.values()).map((p) => p.parent_id).filter(Boolean))));

  const seen = new Set<string>();
  const out: any[] = [];
  for (const r of regs ?? []) {
    const key = r.player_id ?? `m:${r.manual_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = r.player_id ? people.get(r.player_id) : null;
    const head = p?.parent_id ? people.get(p.parent_id) : p;
    const remarks = String(r.notes ?? '').replace(/^VOLUNTEER( \| )?/, '');
    out.push({
      name: p?.full_name ?? r.manual_name ?? '',
      mobile: p?.mobile ?? head?.mobile ?? r.manual_mobile ?? '',
      familyHead: p?.parent_id ? head?.full_name ?? '' : '',
      remarks,
      status: r.status,
    });
  }
  return NextResponse.json({ volunteers: out });
}
