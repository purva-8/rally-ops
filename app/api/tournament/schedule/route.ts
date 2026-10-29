import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventOrganizer } from '@/lib/organizer';
import { validSlot, type Slot } from '@/lib/schedule';

// Organizers save which day and 2-hour block each category plays in.
// Body: { tournamentId, schedule: { minutesPerMatch, assign: { [category]: { day, block } } } }.
// Needs the tournaments.schedule column (supabase/schedule.sql).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { tournamentId, schedule } = (await req.json().catch(() => ({}))) as
    { tournamentId?: string; schedule?: { minutesPerMatch?: unknown; firstDayRound1?: unknown; assign?: Record<string, unknown> } };
  const minutes = schedule?.minutesPerMatch;
  if (!tournamentId || !schedule || !Number.isInteger(minutes) || (minutes as number) < 5 || (minutes as number) > 60
    || !schedule.assign || typeof schedule.assign !== 'object') {
    return NextResponse.json({ error: 'Invalid schedule' }, { status: 400 });
  }
  const assign: Record<string, Slot> = {};
  for (const [cat, v] of Object.entries(schedule.assign)) {
    if (!/^[a-z0-9_]{1,40}$/.test(cat) || !validSlot(v)) return NextResponse.json({ error: 'Invalid schedule' }, { status: 400 });
    assign[cat] = { day: v.day, block: v.block };
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const admin = createAdminClient();
    const { data: t } = await admin.from('tournaments').select('created_by').eq('id', tournamentId).single();
    if (!t || !(await isEventOrganizer(admin, tournamentId, user.id, t.created_by))) {
      return NextResponse.json({ error: 'Only organizers can change the schedule' }, { status: 403 });
    }
    const { error } = await admin.from('tournaments').update({ schedule: { minutesPerMatch: minutes, firstDayRound1: schedule.firstDayRound1 !== false, assign } }).eq('id', tournamentId);
    if (error) {
      console.error('schedule save failed', error);
      const missing = /schedule/.test(error.message ?? '');
      return NextResponse.json({ error: missing ? 'Saving needs a database update first (supabase/schedule.sql)' : 'Could not save the schedule' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error saving schedule:', err);
    return NextResponse.json({ error: 'Failed to save the schedule' }, { status: 500 });
  }
}
