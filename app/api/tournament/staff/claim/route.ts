import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { tournamentId } = body;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const query = supabase
    .from('tournament_staff')
    .select('*')
    .eq('email', user.email.toLowerCase())
    .is('user_id', null);

  const { data: pending } = tournamentId
    ? await query.eq('tournament_id', tournamentId)
    : await query;

  if (!pending || pending.length === 0) {
    return NextResponse.json({ claimed: [] });
  }

  const ids = pending.map((p) => p.id);
  const { data: claimed, error } = await supabase
    .from('tournament_staff')
    .update({ user_id: user.id, status: 'active' })
    .in('id', ids)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ claimed });
}
