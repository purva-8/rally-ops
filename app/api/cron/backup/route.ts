import { NextRequest, NextResponse } from 'next/server';
import { deflateRawSync } from 'zlib';
import * as XLSX from 'xlsx';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMail } from '@/lib/email';

export const maxDuration = 60;

// Brevo only accepts certain attachment types (zip yes, gz no), so the full copy is packed as a one-file zip
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf: Buffer) { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zipOne(name: string, data: Buffer) {
  const comp = deflateRawSync(data), crc = crc32(data), nm = Buffer.from(name);
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
  lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8); cd.writeUInt16LE(8, 10);
  cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nm.length, 28);
  const offset = lh.length + nm.length + comp.length, cdSize = cd.length + nm.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([lh, nm, comp, cd, nm, end]);
}

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
    
    // A human-friendly copy: people and entries, one sheet each
    const wb = XLSX.utils.book_new();
    const flat = (rows: any[]) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v !== null && typeof v === 'object' ? JSON.stringify(v) : v])));
    for (const t of ['player_profiles', 'registrations', 'matches', 'tournament_staff']) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flat(data[t])), t);
    }
    const xlsx = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const counts = TABLES.map((t) => `${t}: ${data[t].length}`).join('<br>');
    // Two separate emails with plain attachment types, so a mail filter that dislikes one still lets the other through
    const fullJson = Buffer.from(JSON.stringify({ takenAt: new Date().toISOString(), data }));
    const first = await sendMail({
      to, kind: 'backup',
      subject: `RallyOps backup ${day} (1 of 2: people and entries)`,
      html: `<p>Daily copy of the database, part 1 of 2: a spreadsheet of people, entries, matches and staff.</p><p>${counts}</p>`,
      attachments: [{ name: `rallyops-people-and-entries-${day}.xlsx`, content: xlsx.toString('base64') }],
    });
    const result = fullJson.length < 3_000_000 ? await sendMail({
      to, kind: 'backup',
      subject: `RallyOps backup ${day} (2 of 2: full copy)`,
      html: `<p>Part 2 of 2: the complete copy of every table (including the change history) as plain text. To restore, save it as a .json file.</p>`,
      attachments: [{ name: `rallyops-full-backup-${day}.txt`, content: fullJson.toString('base64') }],
    }) : { ok: false, error: 'Full copy is over 3 MB, too big for one email' };
    if (!first.ok) throw new Error(first.error ?? 'Email failed');
    if (!result.ok) throw new Error(result.error ?? 'Email failed');
    return NextResponse.json({ ok: true, to, sizeKb: Math.round(fullJson.length / 1024), counts: Object.fromEntries(TABLES.map((t) => [t, data[t].length])) });
  } catch (err) {
    console.error('Backup failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
