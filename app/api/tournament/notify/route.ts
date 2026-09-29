import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isEventOrganizer } from '@/lib/organizer';
import { runNotifications } from '@/lib/notify';

export const maxDuration = 60;

// "Send updates now": the organizer triggers the same run the daily job does, for one tournament
export async function POST(req: NextRequest) {
  const { tournamentId, registrationIds } = await req.json().catch(() => ({}));
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: t } = await supabase.from('tournaments').select('created_by').eq('id', tournamentId).single();
  if (!t || !(await isEventOrganizer(supabase, tournamentId, user.id, t.created_by))) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  try {
    return NextResponse.json({ ok: true, ...(await runNotifications({ tournamentId, registrationIds: Array.isArray(registrationIds) && registrationIds.length ? registrationIds : undefined })) });
  } catch (err) {
    console.error('Notification run failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
