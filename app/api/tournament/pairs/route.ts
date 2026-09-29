import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { categoryLabel } from '@/lib/categories';

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (s: string | null | undefined) => norm(s).split(' ').filter(Boolean);

async function authorize(tournamentId: string | null) {
  if (!tournamentId) return { error: NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 }) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: t } = await supabase.from('tournaments').select('id, created_by').eq('id', tournamentId).single();
  if (!t || t.created_by !== user.id) return { error: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) };
  return { t };
}

// Doubles entries that are not linked to a partner yet, with the most likely match for each
export async function GET(req: NextRequest) {
  const a = await authorize(new URL(req.url).searchParams.get('tournamentId'));
  if (a.error) return a.error;
  const admin = createAdminClient();

  const { data: regs } = await admin.from('registrations')
    .select('id, player_id, category, partner_name, status')
    .eq('tournament_id', a.t!.id).like('category', '%doubles%')
    .is('partner_id', null).neq('status', 'withdrawn').neq('status', 'rejected').not('player_id', 'is', null);
  const ids = Array.from(new Set((regs ?? []).map((r) => r.player_id)));
  const { data: people } = ids.length ? await admin.from('player_profiles').select('id, full_name, mobile').in('id', ids) : { data: [] as any[] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  const entries = (regs ?? []).map((r) => ({
    id: r.id, category: r.category, categoryLabel: categoryLabel(r.category), status: r.status,
    name: byId.get(r.player_id)?.full_name ?? '', mobile: byId.get(r.player_id)?.mobile ?? '', says: r.partner_name ?? '',
  }));

  const score = (e: typeof entries[number], o: typeof entries[number]) => {
    // how well does their typed partner name fit the other person, and vice versa
    const overlap = (typed: string, real: string) => { const t = tokens(typed), r = tokens(real); return t.length ? t.filter((x) => r.some((y) => y === x || y.startsWith(x) || x.startsWith(y))).length / t.length : 0; };
    return overlap(e.says, o.name) + overlap(o.says, e.name);
  };
  const out = entries.map((e) => {
    const pool = entries.filter((o) => o.id !== e.id && o.category === e.category);
    const ranked = pool.map((o) => ({ id: o.id, name: o.name, says: o.says, score: score(e, o) })).sort((x, y) => y.score - x.score);
    return { ...e, options: ranked, suggestion: ranked[0] && ranked[0].score > 0.4 ? ranked[0].id : null };
  });
  return NextResponse.json({ entries: out });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const a = await authorize(body.tournamentId ?? null);
  if (a.error) return a.error;
  if (!body.a || !body.b || body.a === body.b) return NextResponse.json({ error: 'Pick two different entries' }, { status: 400 });
  const admin = createAdminClient();
  const { data: rows } = await admin.from('registrations').select('id, tournament_id, category').in('id', [body.a, body.b]);
  if (!rows || rows.length !== 2 || rows.some((r) => r.tournament_id !== a.t!.id) || rows[0].category !== rows[1].category) {
    return NextResponse.json({ error: 'Entries must be in the same category of this tournament' }, { status: 400 });
  }
  const { error } = await admin.rpc('pair_registrations', { a: body.a, b: body.b });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
