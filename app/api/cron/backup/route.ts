import { NextRequest, NextResponse } from 'next/server';
import { gzipSync } from 'zlib';
import * as XLSX from 'xlsx';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMail } from '@/lib/email';

export const maxDuration = 60;

const TABLES = ['tournaments', 'player_profiles', 'registrations', 'matches', 'match_sets', 'tournament_staff', 'audit_log', 'email_log'];
const PAGE = 1000;

// A full copy of the data, emailed to the owner every day. Free alternative to paid database backups.
// Called by Vercel Cron with "Authorization: Bearer <CRON_SECRET>". Recipient: BACKUP_EMAIL (or the first DEV_ADMIN_EMAILS entry).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const to = process.env.BACKUP_EMAIL ?? (process.env.DEV_ADMIN_EMAILS ?? 'purvahk08@gmail.com').split(',')[0].trim();

  try {
    const admin = createAdminClient();
    const data: Record<string, any[]> = {};
    for (const t of TABLES) {
      const rows: any[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data: part, error } = await admin.from(t).select('*').range(from, from + PAGE - 1);
        if (error) throw new Error(`${t}: ${error.message}`);
        rows.push(...(part ?? []));
        if (!part || part.length < PAGE) break;
      }
      data[t] = rows;
    }

    const day = new Date().toISOString().slice(0, 10);
    const json = gzipSync(Buffer.from(JSON.stringify({ takenAt: new Date().toISOString(), data })));

    // A human-friendly copy: people and entries, one sheet each
    const wb = XLSX.utils.book_new();
    const flat = (rows: any[]) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v !== null && typeof v === 'object' ? JSON.stringify(v) : v])));
    for (const t of ['player_profiles', 'registrations', 'matches', 'tournament_staff']) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flat(data[t])), t);
    }
    const xlsx = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const counts = TABLES.map((t) => `${t}: ${data[t].length}`).join('<br>');
    const result = await sendMail({
      to, kind: 'backup',
      subject: `RallyOps daily backup ${day}`,
      html: `<p>Daily copy of the database.</p><p>${counts}</p><p>Attached: the full copy (<b>.json.gz</b>, for restoring) and a spreadsheet of people and entries. Keep a few of these emails.</p>`,
      attachments: [
        { name: `rallyops-backup-${day}.json.gz`, content: json.toString('base64') },
        { name: `rallyops-people-and-entries-${day}.xlsx`, content: xlsx.toString('base64') },
      ],
    });
    if (!result.ok) throw new Error(result.error ?? 'Email failed');
    return NextResponse.json({ ok: true, to, sizeKb: Math.round(json.length / 1024), counts: Object.fromEntries(TABLES.map((t) => [t, data[t].length])) });
  } catch (err) {
    console.error('Backup failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
