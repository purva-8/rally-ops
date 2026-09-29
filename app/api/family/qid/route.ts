import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Set the Qatar ID of a family member. Done on the server so it either saves or says why it could not.
export async function POST(req: NextRequest) {
  const { profileId, qid } = await req.json().catch(() => ({}));
  const clean = typeof qid === 'string' ? qid.trim() : '';
  if (!profileId) return NextResponse.json({ error: 'Missing person' }, { status: 400 });
  if (clean && !/^\d{11}$/.test(clean)) return NextResponse.json({ error: 'Qatar ID is 11 digits' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: person } = await admin.from('player_profiles').select('id, parent_id, auth_user_id').eq('id', profileId).single();
  if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 });
  const owner = person.parent_id ? (await admin.from('player_profiles').select('auth_user_id').eq('id', person.parent_id).single()).data : person;
  if (owner?.auth_user_id !== user.id) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const { data, error } = await admin.from('player_profiles').update({ qid: clean || null }).eq('id', profileId).select('id, qid').single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Could not save' }, { status: 500 });
  await admin.from('audit_log').insert({ actor: user.id, action: 'UPDATE_QID', table_name: 'player_profiles', row_id: profileId, new_row: { qid: data.qid } });
  return NextResponse.json({ ok: true, qid: data.qid });
}
