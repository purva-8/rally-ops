import { NextRequest, NextResponse } from 'next/server';
import { getDevUser } from '@/lib/devAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

// Creates a one-time sign-in link for a household's account so you can see exactly what they see.
// Every use is recorded in the audit log.
export async function POST(req: NextRequest) {
  const dev = await getDevUser();
  if (!dev) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const { profileId } = await req.json().catch(() => ({}));
  if (!profileId) return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: person } = await admin.from('player_profiles').select('id, parent_id, auth_user_id').eq('id', profileId).single();
  const accountId = person?.parent_id ?? person?.id;
  const { data: account } = accountId ? await admin.from('player_profiles').select('auth_user_id').eq('id', accountId).single() : { data: null };
  if (!account?.auth_user_id) return NextResponse.json({ error: 'This person has no login of their own' }, { status: 404 });

  const { data: u } = await admin.auth.admin.getUserById(account.auth_user_id);
  const email = u?.user?.email;
  if (!email) return NextResponse.json({ error: 'No email on file' }, { status: 404 });

  const origin = new URL(req.url).origin;
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: `${origin}/profile` } });
  if (error || !data?.properties?.hashed_token) return NextResponse.json({ error: error?.message ?? 'Could not create link' }, { status: 500 });

  await admin.from('audit_log').insert({ actor: dev.id, action: 'IMPERSONATE', table_name: 'player_profiles', row_id: profileId, new_row: { as_email: email } });
  const link = `${origin}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink&next=/profile`;
  return NextResponse.json({ link, email });
}
