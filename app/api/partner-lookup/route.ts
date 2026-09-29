import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Find people by Qatar ID so a doubles partner can be linked. Only signed-in users can search,
// only an exact ID matches, and only the minimum (id, name, gender) is returned.
export async function GET(req: NextRequest) {
  const qid = new URL(req.url).searchParams.get('qid')?.trim();
  if (!qid || qid.length < 6) return NextResponse.json({ people: [] });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await createAdminClient()
    .from('player_profiles')
    .select('id, full_name, gender, parent_id, relationship')
    .eq('qid', qid)
    .limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    people: (data ?? []).map((p) => ({ id: p.id, name: p.full_name, gender: p.gender, relationship: p.relationship })),
  });
}
