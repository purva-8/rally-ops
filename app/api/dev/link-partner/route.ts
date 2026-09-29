import { NextRequest, NextResponse } from 'next/server';
import { getDevUser } from '@/lib/devAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

// Manually pair two doubles entries (registration ids) when the names didn't match on their own
export async function POST(req: NextRequest) {
  const dev = await getDevUser();
  if (!dev) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const { a, b } = await req.json().catch(() => ({}));
  if (!a || !b || a === b) return NextResponse.json({ error: 'Need two different registration ids' }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.rpc('pair_registrations', { a, b });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
