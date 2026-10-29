import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventOrganizer } from '@/lib/organizer';
import { categoryFee, isDoublesCategory } from '@/lib/categories';

// Organizers register someone who already has a profile on the app (on the spot, at the desk). The entry is
// approved straight away; it is unpaid if the category has a fee, like a player's own entry.
// Body: { tournamentId, category, playerId, partnerId?, partnerName? }.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { tournamentId, category, playerId, partnerId, partnerName } = (await req.json().catch(() => ({}))) as
    { tournamentId?: string; category?: string; playerId?: string; partnerId?: string | null; partnerName?: string | null };
  if (!tournamentId || !category || !playerId) return NextResponse.json({ error: 'Choose a person and a category' }, { status: 400 });
  const doubles = isDoublesCategory(category);
  if (doubles && partnerId === playerId) return NextResponse.json({ error: 'A player cannot partner themselves' }, { status: 400 });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const admin = createAdminClient();
    const { data: t } = await admin.from('tournaments').select('created_by, categories, entry_fee').eq('id', tournamentId).single();
    if (!t || !(await isEventOrganizer(admin, tournamentId, user.id, t.created_by))) {
      return NextResponse.json({ error: 'Only organizers can register players here' }, { status: 403 });
    }
    if (!(t.categories ?? []).includes(category)) return NextResponse.json({ error: 'This event has no such category' }, { status: 400 });

    const ids = [playerId, ...(doubles && partnerId ? [partnerId] : [])];
    const { data: people } = await admin.from('player_profiles').select('id, full_name').in('id', ids);
    const byId = new Map((people ?? []).map((p) => [p.id, p.full_name as string]));
    if (ids.some((i) => !byId.has(i))) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const { data: existing } = await admin.from('registrations').select('id, status')
      .eq('tournament_id', tournamentId).eq('category', category).eq('player_id', playerId);
    if ((existing ?? []).some((r) => r.status !== 'withdrawn' && r.status !== 'rejected')) {
      return NextResponse.json({ error: `${byId.get(playerId)} is already entered in this category` }, { status: 409 });
    }

    const partner = doubles ? (partnerId ? byId.get(partnerId)! : (partnerName ?? '').trim()) : '';
    const { data: row, error } = await admin.from('registrations').insert({
      tournament_id: tournamentId,
      player_id: playerId,
      category,
      partner_id: doubles && partnerId ? partnerId : null,
      partner_name: partner || null,
      status: 'approved',
      approved_at: new Date().toISOString(),
      payment_status: categoryFee(category, t.entry_fee ?? 0) > 0 ? 'unpaid' : 'waived',
    }).select('id').single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: `${byId.get(playerId)} is already entered in this category` }, { status: 409 });
      console.error('register on the spot failed', error);
      return NextResponse.json({ error: 'Could not add the entry' }, { status: 500 });
    }
    return NextResponse.json({ id: row?.id, name: byId.get(playerId), partner: partner || null });
  } catch (err) {
    console.error('Error adding entry:', err);
    return NextResponse.json({ error: 'Failed to add the entry' }, { status: 500 });
  }
}
