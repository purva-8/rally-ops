import { NextRequest, NextResponse } from 'next/server';
import { getDevUser } from '@/lib/devAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

// Everything about one person and their household, plus the recent change history for those rows
export async function GET(req: NextRequest) {
  if (!(await getDevUser())) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const admin = createAdminClient();

  const { data: person } = await admin.from('player_profiles').select('*').eq('id', id).single();
  if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const accountId = person.parent_id ?? person.id;
  const { data: account } = await admin.from('player_profiles').select('*').eq('id', accountId).single();
  const { data: kids } = await admin.from('player_profiles').select('*').eq('parent_id', accountId);
  const household = [account, ...(kids ?? [])].filter(Boolean);
  const ids = household.map((p) => p.id);

  let email: string | null = null;
  if (account?.auth_user_id) {
    const { data } = await admin.auth.admin.getUserById(account.auth_user_id);
    email = data?.user?.email ?? null;
  }

  const { data: registrations } = await admin
    .from('registrations')
    .select('*, tournaments ( name )')
    .or(`player_id.in.(${ids.join(',')}),partner_id.in.(${ids.join(',')})`)
    .order('created_at', { ascending: true });

  const rowIds = [...ids, ...(registrations ?? []).map((r) => r.id)];
  const { data: history } = await admin
    .from('audit_log')
    .select('id, at, actor, action, table_name, row_id, old_row, new_row')
    .in('row_id', rowIds)
    .order('at', { ascending: false })
    .limit(40);

  return NextResponse.json({ account, email, household, registrations, history });
}
