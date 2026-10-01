import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventOrganizer } from '@/lib/organizer';
import { isEligible, partnerIssue } from '@/lib/categories';

// For the approvers: which entries break the category rules (age, gender, partner), so nobody has to work it out by hand
export async function GET(req: NextRequest) {
  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: t } = await supabase.from('tournaments').select('id, created_by, event_date, age_as_of').eq('id', tournamentId).single();
  if (!t || !(await isEventOrganizer(supabase, t.id, user.id, t.created_by))) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const admin = createAdminClient();
  const asOf = t.age_as_of ?? t.event_date;
  const { data: regs } = await admin.from('registrations').select('id, player_id, partner_id, category, status').eq('tournament_id', tournamentId).neq('status', 'withdrawn');
  const ids = Array.from(new Set((regs ?? []).flatMap((r) => [r.player_id, r.partner_id]).filter(Boolean)));
  const profiles = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await admin.from('player_profiles').select('id, full_name, gender, dob, relationship, parent_id').in('id', ids.slice(i, i + 100));
    (data ?? []).forEach((p) => profiles.set(p.id, p));
  }
  const issues: Record<string, string[]> = {};
  for (const r of regs ?? []) {
    const me = profiles.get(r.player_id);
    if (!me) continue;
    const list: string[] = [];
    if (!isEligible(r.category, me.gender, me.dob, asOf)) list.push(`${me.full_name} does not meet the age or gender rule for this category`);
    if (r.partner_id) {
      const pt = profiles.get(r.partner_id);
      if (pt) {
        const why = partnerIssue(
          r.category,
          { gender: me.gender, dob: me.dob, relationship: me.relationship, isAccountHolder: !me.parent_id },
          { gender: pt.gender, dob: pt.dob, relationship: pt.relationship, isAccountHolder: !pt.parent_id, sameHousehold: (me.parent_id ?? me.id) === (pt.parent_id ?? pt.id) },
          asOf,
        );
        if (why) list.push(`Partner ${pt.full_name}: ${why}`);
      }
    }
    if (list.length) issues[r.id] = list;
  }
  return NextResponse.json({ issues });
}
