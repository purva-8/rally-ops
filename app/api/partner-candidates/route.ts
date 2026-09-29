import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const namesMatch = (a: string | null, b: string | null) => {
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x === y || x.startsWith(y + ' ') || y.startsWith(x + ' '));
};

// People who already entered this category and named the given player as their partner.
// Only returned for a player in the caller's own household.
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams;
  const tournamentId = q.get('tournamentId'), category = q.get('category'), playerId = q.get('playerId');
  if (!tournamentId || !category || !playerId) return NextResponse.json({ people: [] });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('player_profiles').select('id, full_name, parent_id, auth_user_id').eq('id', playerId).single();
  if (!me) return NextResponse.json({ people: [] });
  const owner = me.parent_id ? (await admin.from('player_profiles').select('auth_user_id').eq('id', me.parent_id).single()).data : me;
  if (owner?.auth_user_id !== user.id) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const { data: regs } = await admin.from('registrations')
    .select('player_id, partner_name')
    .eq('tournament_id', tournamentId).eq('category', category)
    .is('partner_id', null).neq('status', 'withdrawn').not('player_id', 'is', null);
  const named = (regs ?? []).filter((r) => r.player_id !== playerId && namesMatch(r.partner_name, me.full_name));
  if (!named.length) return NextResponse.json({ people: [] });

  const { data: people } = await admin.from('player_profiles').select('id, full_name').in('id', named.map((r) => r.player_id));
  return NextResponse.json({ people: (people ?? []).map((p) => ({ id: p.id, name: p.full_name })) });
}
