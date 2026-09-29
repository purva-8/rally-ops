import { NextRequest, NextResponse } from 'next/server';
import { getDevUser } from '@/lib/devAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  if (!(await getDevUser())) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const q = (new URL(req.url).searchParams.get('q') ?? '').replace(/[,()%*]/g, ' ').trim();
  const admin = createAdminClient();

  let query = admin
    .from('player_profiles')
    .select('id, full_name, qid, mobile, gender, parent_id, relationship, samanvayam_member, samanvayam_id, created_at')
    .order('created_at', { ascending: false })
    .limit(40);
  if (q) query = query.or(`full_name.ilike.%${q}%,qid.ilike.%${q}%,mobile.ilike.%${q}%,samanvayam_id.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ people: data });
}
