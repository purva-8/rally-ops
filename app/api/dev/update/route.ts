import { NextRequest, NextResponse } from 'next/server';
import { getDevUser } from '@/lib/devAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED: Record<string, string[]> = {
  player_profiles: ['full_name', 'mobile', 'gender', 'dob', 'qid', 'samanvayam_member', 'samanvayam_id', 'relationship', 'parent_id'],
  registrations: ['status', 'payment_status', 'payment_ref', 'partner_id', 'partner_name', 'category', 'review_comment', 'notes', 'emergency_contact'],
};

// Edit one row. The change is written to the audit log with your identity, so it can always be traced and undone.
export async function POST(req: NextRequest) {
  const dev = await getDevUser();
  if (!dev) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const { table, id, patch } = await req.json().catch(() => ({}));
  const fields = ALLOWED[table];
  if (!fields || !id || typeof patch !== 'object') return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (fields.includes(k)) clean[k] = v === '' ? null : v;
  if (Object.keys(clean).length === 0) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  const admin = createAdminClient();
  const { data: before } = await admin.from(table).select('*').eq('id', id).single();
  const { data: after, error } = await admin.from(table).update(clean).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from('audit_log').insert({
    actor: dev.id, action: 'DEV_EDIT', table_name: table, row_id: id,
    tournament_id: (after as { tournament_id?: string } | null)?.tournament_id ?? null,
    old_row: before, new_row: after,
  });
  return NextResponse.json({ ok: true, row: after });
}
