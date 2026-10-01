import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ageOn } from '@/lib/categories';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function lev(a: string, b: string) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
const tokenSim = (q: string, t: string) => {
  if (t.startsWith(q) || q.startsWith(t)) return Math.min(q.length, t.length) >= 3 ? 1 : 0.7;
  return 1 - lev(q, t) / Math.max(q.length, t.length);
};

// Forgiving name search for choosing a doubles partner: ignores case, tolerates typos and partial names.
// Only signed-in users; returns just id, name, and a masked hint so people with the same name can be told apart.
export async function GET(req: NextRequest) {
  const q = norm(new URL(req.url).searchParams.get('q') ?? '');
  if (q.length < 2) return NextResponse.json({ people: [] });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await createAdminClient().from('player_profiles').select('id, full_name, mobile, gender, dob, parent_id, relationship').limit(5000);
  const eventDate = new URL(req.url).searchParams.get('eventDate') ?? new Date().toISOString().slice(0, 10);
  const qt = q.split(' ');
  const scored = (data ?? []).map((p) => {
    const nt = norm(p.full_name).split(' ');
    const s = qt.reduce((sum, t) => sum + Math.max(...nt.map((x) => tokenSim(t, x))), 0) / qt.length;
    return { p, s };
  }).filter((x) => x.s >= 0.65).sort((a, b) => b.s - a.s).slice(0, 6);

  return NextResponse.json({
    people: scored.map(({ p }) => ({
      id: p.id, name: p.full_name, gender: p.gender, age: p.dob ? ageOn(p.dob, eventDate) : null,
      hint: p.mobile ? `mobile ending ${p.mobile.replace(/\D/g, '').slice(-3)}` : p.parent_id ? 'family member' : '',
    })),
  });
}
