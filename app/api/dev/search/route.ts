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
  // Forgiving name match: "kashvi" also finds "Kaashvi" (letters in order, anything in between)
  const loose = /^[a-z ]{3,}$/i.test(q) ? `%${q.replace(/ /g, '').split('').join('%')}%` : null;
  if (q) query = query.or(`full_name.ilike.%${q}%,${loose ? `full_name.ilike.${loose},` : ''}qid.ilike.%${q}%,mobile.ilike.%${q}%,samanvayam_id.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Return whole families: every matched person's account holder plus all members under that account
  const heads = Array.from(new Set((data ?? []).map((p) => p.parent_id ?? p.id)));
  if (!heads.length) return NextResponse.json({ people: [] });
  const cols = 'id, full_name, qid, mobile, gender, parent_id, relationship, samanvayam_member, samanvayam_id, created_at';
  const [{ data: hs }, { data: kids }] = await Promise.all([
    admin.from('player_profiles').select(cols).in('id', heads),
    admin.from('player_profiles').select(cols).in('parent_id', heads),
  ]);
  return NextResponse.json({ people: [...(hs ?? []), ...(kids ?? [])] });
}
