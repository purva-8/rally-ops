import { NextRequest, NextResponse } from 'next/server';
import { getDevUser } from '@/lib/devAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

// Undo a change or a deletion using its audit log entry
export async function POST(req: NextRequest) {
  const dev = await getDevUser();
  if (!dev) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const { auditId } = await req.json().catch(() => ({}));
  if (!auditId) return NextResponse.json({ error: 'Missing auditId' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('restore_from_audit', { p_audit_id: auditId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from('audit_log').insert({ actor: dev.id, action: 'DEV_RESTORE', table_name: 'audit_log', row_id: String(auditId), new_row: { result: data } });
  return NextResponse.json({ ok: true, result: data });
}
