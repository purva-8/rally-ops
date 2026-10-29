import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventOrganizer } from '@/lib/organizer';

export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows are passed through as stored
type Row = Record<string, any>;
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// Organizers download everything needed to rebuild the event: entries, matches and scores, desk payments and
// removals, and the match history. Tables that don't exist yet are left out. Profiles are id, name and family only.
export async function GET(req: NextRequest) {
  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();
  const { data: t } = await admin.from('tournaments').select('*').eq('id', tournamentId).single();
  if (!t || !(await isEventOrganizer(admin, tournamentId, user.id, t.created_by))) {
    return NextResponse.json({ error: 'Only organizers can download a backup' }, { status: 403 });
  }

  const all = async (table: string, col = 'tournament_id', ids: string[] = [tournamentId]) => {
    const out: Row[] = [];
    for (const part of chunk(ids, 100)) {
      for (let from = 0; ; from += 1000) {
        const { data, error } = await admin.from(table).select('*').in(col, part).range(from, from + 999);
        if (error) return null;
        out.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
    }
    return out;
  };
  const registrations = await all('registrations');
  const matches = await all('matches');
  const matchSets = matches?.length ? await all('match_sets', 'match_id', matches.map((m) => m.id)) : [];
  const ids = Array.from(new Set((registrations ?? []).flatMap((r) => [r.player_id, r.partner_id]).filter(Boolean)));
  const profiles: Row[] = [];
  for (const part of chunk(ids, 100)) {
    const { data } = await admin.from('player_profiles').select('id, full_name, parent_id').in('id', part);
    profiles.push(...(data ?? []));
  }

  const backup = {
    takenAt: new Date().toISOString(),
    tournament: t,
    registrations, profiles, matches, match_sets: matchSets,
    bill_payments: await all('bill_payments'),
    bill_removals: await all('bill_removals'),
    match_log: await all('match_log'),
  };
  const stamp = backup.takenAt.slice(0, 16).replace(/[:T]/g, '-');
  return new NextResponse(JSON.stringify(backup), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="rallyops-backup-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
