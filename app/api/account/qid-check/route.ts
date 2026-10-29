import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// One account per family: before an account holder saves a Qatar ID, check no other account already has it, so the
// same family can't end up on two emails (and two bills). Returns only a masked email so they know which one to use.
// Body: { qid }.
const mask = (email: string) => email.replace(/^(.{2})[^@]*(@.*)$/, (_, a, b) => `${a}***${b}`);

export async function POST(req: NextRequest) {
  const { qid } = (await req.json().catch(() => ({}))) as { qid?: string };
  const clean = typeof qid === 'string' ? qid.trim() : '';
  if (!clean) return NextResponse.json({ taken: false });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: holders } = await admin.from('player_profiles').select('auth_user_id').eq('qid', clean).is('parent_id', null);
  const other = (holders ?? []).find((h) => h.auth_user_id && h.auth_user_id !== user.id);
  if (!other) return NextResponse.json({ taken: false });
  const { data } = await admin.auth.admin.getUserById(other.auth_user_id);
  return NextResponse.json({ taken: true, hint: data?.user?.email ? mask(data.user.email) : null });
}
