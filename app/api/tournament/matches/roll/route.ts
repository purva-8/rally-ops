import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventOrganizer } from '@/lib/organizer';
import { rollPairs } from '@/lib/quickMatch';
import { keptApart } from '@/lib/keepApart';

type Entry = { id: string; label: string };

// Roll the dice for the match maker. Rolled here so the organizers' settings stay on the server.
// Body: { tournamentId, category, entries: [{ id, label }] }. Returns { pairs, waiting }; nothing is saved.
export async function POST(req: NextRequest) {
  const { tournamentId, category, entries } = (await req.json().catch(() => ({}))) as { tournamentId?: string; category?: string; entries?: Entry[] };
  if (!tournamentId || !category || !Array.isArray(entries) || entries.length < 2 || entries.length > 64
    || entries.some((e) => typeof e?.label !== 'string' || typeof e?.id !== 'string')) {
    return NextResponse.json({ error: 'Pick a category and at least two players' }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();
  const { data: t } = await admin.from('tournaments').select('created_by').eq('id', tournamentId).single();
  if (!t || !(await isEventOrganizer(admin, tournamentId, user.id, t.created_by))) {
    return NextResponse.json({ error: 'Only organizers can make matches' }, { status: 403 });
  }
  const clean = entries.map(({ id, label }) => ({ id, label }));
  return NextResponse.json(rollPairs(clean, Math.random, (x, y) => keptApart(category, x.label, y.label)));
}
