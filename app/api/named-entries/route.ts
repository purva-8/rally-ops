import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Who entered a doubles category naming someone in my family as their partner. Only the entrant's name is returned,
// and only for entries that name my own household, so other profile details stay private.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ names: {} });

  const admin = createAdminClient();
  const { data: head } = await admin.from('player_profiles').select('id').eq('auth_user_id', user.id).is('parent_id', null).maybeSingle();
  if (!head) return NextResponse.json({ names: {} });
  const { data: kids } = await admin.from('player_profiles').select('id').eq('parent_id', head.id);
  const mine = [head.id, ...(kids ?? []).map((k) => k.id)];

  const { data: regs } = await admin.from('registrations').select('id, player_id').in('partner_id', mine).not('player_id', 'in', `(${mine.join(',')})`).neq('status', 'withdrawn');
  const ids = Array.from(new Set((regs ?? []).map((r) => r.player_id).filter(Boolean)));
  if (!ids.length) return NextResponse.json({ names: {} });
  const { data: people } = await admin.from('player_profiles').select('id, full_name').in('id', ids);
  const nameOf = new Map((people ?? []).map((p) => [p.id, (p.full_name ?? '').trim()]));
  const names: Record<string, string> = {};
  (regs ?? []).forEach((r) => { names[r.id] = nameOf.get(r.player_id) ?? ''; });
  return NextResponse.json({ names });
}
