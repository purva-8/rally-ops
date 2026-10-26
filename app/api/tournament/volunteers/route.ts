import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventOrganizer } from '@/lib/organizer';

// People who ticked "I would like to volunteer" or left a remark, with a number to reach them on (their own, or their family's)
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
    .eq('tournament_id', tournamentId).not('notes', 'is', null).neq('status', 'withdrawn').order('created_at');

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

  // One row per person: did they tick volunteer, and what remarks did they leave
  const byKey = new Map<string, any>();
  for (const r of regs ?? []) {
    const parts = String(r.notes ?? '').split('|').map((x) => x.trim()).filter(Boolean);
    const volunteer = parts.includes('VOLUNTEER');
    const remark = parts.filter((x) => x !== 'VOLUNTEER' && x !== 'RESOLVED' && x !== 'PAIRED' && x.toUpperCase() !== 'N/A').join(' | ');
    const resolved = parts.includes('RESOLVED');
    if (!volunteer && !remark) continue;
    const key = r.player_id ?? `m:${r.manual_name}`;
    const p = r.player_id ? people.get(r.player_id) : null;
    const head = p?.parent_id ? people.get(p.parent_id) : p;
    const row = byKey.get(key) ?? {
      name: p?.full_name ?? r.manual_name ?? '',
      mobile: p?.mobile ?? head?.mobile ?? r.manual_mobile ?? '',
      familyHead: p?.parent_id ? head?.full_name ?? '' : '',
      volunteer: false, remarks: [] as string[], status: r.status, key, playerId: r.player_id ?? null, manualName: r.manual_name ?? null, openRemarks: 0,
    };
    row.volunteer = row.volunteer || volunteer;
    if (remark && !row.remarks.includes(remark)) row.remarks.push(remark);
    if (remark && !resolved) row.openRemarks += 1;
    byKey.set(key, row);
  }
  // The rest of each household: everyone in the family who has a live entry, so a head's row shows who they registered
  const heads = Array.from(new Set(Array.from(byKey.values()).filter((v) => v.playerId).map((v) => {
    const p = people.get(v.playerId); return p?.parent_id ?? p?.id;
  }).filter(Boolean)));
  const household = new Map<string, any[]>();
  if (heads.length) {
    const { data: kin } = await admin.from('player_profiles').select('id, full_name, parent_id').or(`id.in.(${heads.join(',')}),parent_id.in.(${heads.join(',')})`);
    const { data: live } = await admin.from('registrations').select('player_id').eq('tournament_id', tournamentId).neq('status', 'withdrawn').neq('status', 'rejected').not('player_id', 'is', null);
    const playing = new Set((live ?? []).map((r) => r.player_id));
    for (const k of kin ?? []) {
      if (!playing.has(k.id)) continue;
      const h = k.parent_id ?? k.id;
      household.set(h, [...(household.get(h) ?? []), k]);
    }
  }
  const out = Array.from(byKey.values()).map((v) => {
    const p = v.playerId ? people.get(v.playerId) : null;
    const family = p ? (household.get(p.parent_id ?? p.id) ?? []).filter((k) => k.id !== v.playerId).map((k) => k.full_name) : [];
    return { ...v, family, solved: v.remarks.length > 0 && v.openRemarks === 0 };
  });
  return NextResponse.json({ volunteers: out });
}


// Mark a person's remarks as solved (or reopen them). Stored as a RESOLVED marker in the entries' notes, next to VOLUNTEER.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { tournamentId, playerId, manualName, solved } = body as { tournamentId?: string; playerId?: string | null; manualName?: string | null; solved?: boolean };
  if (!tournamentId || (!playerId && !manualName)) return NextResponse.json({ error: 'Missing person' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: t } = await supabase.from('tournaments').select('id, created_by').eq('id', tournamentId).single();
  if (!t || !(await isEventOrganizer(supabase, t.id, user.id, t.created_by))) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const admin = createAdminClient();
  let q = admin.from('registrations').select('id, notes').eq('tournament_id', tournamentId).not('notes', 'is', null);
  q = playerId ? q.eq('player_id', playerId) : q.eq('manual_name', manualName!);
  const { data: regs } = await q;
  let changed = 0;
  for (const r of regs ?? []) {
    const parts = String(r.notes ?? '').split('|').map((x) => x.trim()).filter(Boolean);
    const hasRemark = parts.some((x) => x !== 'VOLUNTEER' && x !== 'RESOLVED' && x !== 'PAIRED' && x.toUpperCase() !== 'N/A');
    if (!hasRemark) continue;
    const next = solved ? (parts.includes('RESOLVED') ? parts : [...parts, 'RESOLVED']) : parts.filter((x) => x !== 'RESOLVED');
    if (next.join(' | ') === parts.join(' | ')) continue;
    await admin.from('registrations').update({ notes: next.join(' | ') }).eq('id', r.id);
    changed++;
  }
  return NextResponse.json({ ok: true, changed });
}
