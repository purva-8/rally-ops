import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isEventOrganizer } from '@/lib/organizer';
import * as XLSX from 'xlsx';
import { toCsv } from '@/lib/csv';
import { formatDate, formatDateTime } from '@/lib/format';
import { ageOn, categoryFee, categoryLabel, isDoublesCategory } from '@/lib/categories';

// Organizer-only CSV exports. Rows are fetched in pages so 1000+ row tables are never silently cut off.
const PAGE = 1000;

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tournamentId = searchParams.get('tournamentId');
  const type = searchParams.get('type') ?? 'registrations';
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tournament } = await supabase
    .from('tournaments').select('id, name, created_by, event_date, entry_fee, age_as_of').eq('id', tournamentId).single();
  if (!tournament || !(await isEventOrganizer(supabase, tournament.id, user.id, tournament.created_by))) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    type Table = { headers: string[]; rows: Record<string, any>[]; familyHalves?: Record<string, any>[] };
    const fee0 = Number(tournament.entry_fee ?? 0);

    const registrationsTable = async () => {
      const regs = await fetchAll<any>((from, to) =>
        supabase.from('registrations').select('*').eq('tournament_id', tournamentId)
          .order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, to));

      const profiles = new Map<string, any>();
      const loadProfiles = async (list: string[]) => {
        const todo = list.filter((id) => !profiles.has(id));
        for (let i = 0; i < todo.length; i += 100) {
          const { data } = await supabase.from('player_profiles')
            .select('id, full_name, gender, dob, mobile, qid, parent_id, relationship, samanvayam_member, samanvayam_id')
            .in('id', todo.slice(i, i + 100));
          (data ?? []).forEach((p) => profiles.set(p.id, p));
        }
      };
      await loadProfiles(Array.from(new Set(regs.flatMap((r) => [r.player_id, r.partner_id]).filter(Boolean))));
      await loadProfiles(Array.from(new Set(Array.from(profiles.values()).map((p) => p.parent_id).filter(Boolean))));
      const householdOf = (id?: string | null) => (id ? profiles.get(id)?.parent_id ?? id : null);

      const rows = regs.map((r, i) => {
        const p = profiles.get(r.player_id);
        const parent = p?.parent_id ? profiles.get(p.parent_id) : null;
        const full = categoryFee(r.category, fee0);
        // A linked partner in a different household pays their own half
        const due = isDoublesCategory(r.category) ? full / 2 : full;
        const partner = r.partner_id ? profiles.get(r.partner_id)?.full_name : null;
        return {
          '#': i + 1,
          'Player': p?.full_name ?? r.manual_name ?? '',
          'Category': categoryLabel(r.category),
          'Partner': partner ?? r.partner_name ?? '',
          // One entry is enough to make a pair: a partner on the portal, or one an organizer confirmed as typed
          'Pairing': isDoublesCategory(r.category)
            ? (r.partner_id ? 'Paired' : String(r.notes ?? '').split('|').map((x: string) => x.trim()).includes('PAIRED') ? 'Paired (partner not on portal)' : 'No partner yet')
            : '',
          'Status': r.status,
          'Fee due (QAR)': due,
          'Payment': r.payment_status ?? '',
          'Registered by (family head)': parent ? parent.full_name : (p?.full_name ?? ''),
          'Relationship': p?.parent_id ? (p?.relationship ?? '') : 'Self',
          'Qatar ID': p?.qid ?? parent?.qid ?? r.manual_qid ?? '',
          'Samanvayam member': (p?.samanvayam_member || parent?.samanvayam_member) ? 'Yes' : 'No',
          'Samanvayam ID': (p?.parent_id ? parent?.samanvayam_id : p?.samanvayam_id) ?? '',
          'Gender': p?.gender ?? '',
          'Date of birth': formatDate(p?.dob),
          'Age (counted date)': p?.dob && (tournament.age_as_of ?? tournament.event_date) ? ageOn(p.dob, tournament.age_as_of ?? tournament.event_date) : '',
          'Mobile': p?.mobile ?? r.manual_mobile ?? parent?.mobile ?? '',
          'Payment ref': r.payment_ref ?? '',
          'Emergency contact': r.emergency_contact ?? '',
          'Volunteer': String(r.notes ?? '').includes('VOLUNTEER') ? 'Yes' : '',
          'Remarks': String(r.notes ?? '').split('|').map((x: string) => x.trim()).filter((x: string) => x && x !== 'VOLUNTEER' && x !== 'RESOLVED' && x !== 'PAIRED').join(' | '),
          'Remark solved': String(r.notes ?? '').split('|').map((x: string) => x.trim()).includes('RESOLVED') ? 'Yes' : '',
          'Review comment': r.review_comment ?? '',
          'Registration code': r.registration_code ?? '',
          'Registered on': formatDateTime(r.created_at),
        };
      });
      // The other half of a doubles pair when the partner has no entry of their own: billed to the partner's family,
      // or, for a partner confirmed as typed (not on the portal), to the family that entered the pair
      const liveRegs = regs.filter((r) => r.status === 'approved' || r.status === 'pending');
      const typedOk = (r: any) => String(r.notes ?? '').split('|').map((x: string) => x.trim()).includes('PAIRED');
      const familyHalves = liveRegs.filter((r) => isDoublesCategory(r.category) && r.payment_status !== 'waived' && ((r.partner_id
        && !liveRegs.some((o) => o.id !== r.id && o.player_id === r.partner_id && o.category === r.category)) || (!r.partner_id && typedOk(r)))).map((r) => {
        const headId = r.partner_id ? householdOf(r.partner_id) : householdOf(r.player_id);
        const head = profiles.get(headId ?? '');
        const own = r.partner_id && householdOf(r.partner_id) !== householdOf(r.player_id) ? r.partner_paid : r.payment_status === 'paid';
        return {
          'Family head': head?.full_name ?? '', Person: r.partner_id ? (profiles.get(r.partner_id)?.full_name ?? '') : (r.partner_name ?? ''), Category: categoryLabel(r.category),
          Partner: profiles.get(r.player_id)?.full_name ?? '', Amount: categoryFee(r.category, fee0) / 2, Payment: own ? 'paid' : (r.payment_status === 'paid' && !r.partner_id ? 'paid' : 'unpaid'), Status: r.status,
        };
      });
      return { headers: Object.keys(rows[0] ?? { '#': 0, Player: 0, Category: 0, Partner: 0, Status: 0, 'Fee due (QAR)': 0, Payment: 0 }), rows, familyHalves } as Table;
    };

    const matchesTable = async () => {
      const matches = await fetchAll<any>((from, to) =>
        supabase.from('matches').select('*').eq('tournament_id', tournamentId)
          .order('category').order('round').order('created_at').range(from, to));
      const sets = matches.length
        ? await fetchAll<any>((from, to) =>
            supabase.from('match_sets').select('*').in('match_id', matches.map((m) => m.id)).order('set_number').range(from, to))
        : [];
      const rows = matches.map((m, i) => ({
        '#': i + 1,
        'Category': categoryLabel(m.category),
        'Round': m.round + 1,
        'Player 1': m.player1_name,
        'Player 2': m.player2_name ?? 'BYE',
        'Scores': sets.filter((s) => s.match_id === m.id).map((s) => `${s.player1_score}-${s.player2_score}`).join(', '),
        'Winner': m.winner_name ?? '',
        'Status': m.status,
        'Court': m.court_id ?? '',
        'Referee': m.referee_name ?? '',
        'Scheduled': formatDateTime(m.scheduled_at),
        'Completed': formatDateTime(m.completed_at),
      }));
      return { headers: ['#', 'Category', 'Round', 'Player 1', 'Player 2', 'Scores', 'Winner', 'Status', 'Court', 'Referee', 'Scheduled', 'Completed'], rows } as Table;
    };

    const auditTable = async () => {
      const log = await fetchAll<any>((from, to) =>
        supabase.from('audit_log').select('*').eq('tournament_id', tournamentId)
          .order('at', { ascending: false }).range(from, to));
      const rows = log.map((l) => ({
        'When': formatDateTime(l.at),
        'Action': l.action,
        'Table': l.table_name,
        'Row id': l.row_id,
        'Actor': l.actor ?? '',
        'Before': l.old_row ? JSON.stringify(l.old_row) : '',
        'After': l.new_row ? JSON.stringify(l.new_row) : '',
      }));
      return { headers: ['When', 'Action', 'Table', 'Row id', 'Actor', 'Before', 'After'], rows } as Table;
    };

    const emailsTable = async () => {
      const log = await fetchAll<any>((from, to) =>
        supabase.from('email_log').select('*').eq('tournament_id', tournamentId)
          .order('at', { ascending: false }).range(from, to));
      const rows = log.map((l) => ({ 'When': formatDateTime(l.at), 'Type': l.kind, 'To': l.to_email, 'Subject': l.subject, 'Status': l.status, 'Error': l.error ?? '' }));
      return { headers: ['When', 'Type', 'To', 'Subject', 'Status', 'Error'], rows } as Table;
    };

    const safeName = tournament.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const day = new Date().toISOString().slice(0, 10);

    if (type === 'workbook') {
      // One Excel file, several clean tabs: Summary, Entries, Families, one per category, Matches, History, Emails
      const [reg, mat, aud, ema] = await Promise.all([registrationsTable(), matchesTable(), auditTable(), emailsTable()]);
      const live = reg.rows.filter((r) => r.Status !== 'withdrawn' && r.Status !== 'rejected');
      const count = (f: (r: any) => boolean) => reg.rows.filter(f).length;
      const sum = (rows: any[]) => rows.reduce((a, r) => a + Number(r['Fee due (QAR)'] || 0), 0);
      const paid = live.filter((r) => String(r.Payment).toLowerCase() === 'paid');
      const halves = reg.familyHalves ?? [];
      const halvesSum = halves.reduce((a, h) => a + Number(h.Amount || 0), 0);
      const halvesPaid = halves.filter((h) => String(h.Payment).toLowerCase() === 'paid').reduce((a, h) => a + Number(h.Amount || 0), 0);

      const summary: (string | number)[][] = [
        [tournament.name],
        [`Exported ${formatDateTime(new Date().toISOString())}`],
        [],
        ['ENTRIES', ''],
        ['Total entries', reg.rows.length],
        ['Pending', count((r) => r.Status === 'pending')],
        ['Approved', count((r) => r.Status === 'approved')],
        ['Rejected', count((r) => r.Status === 'rejected')],
        ['Withdrawn', count((r) => r.Status === 'withdrawn')],
        [],
        ['MONEY (QAR, excludes rejected and withdrawn)', ''],
        ['Total due (includes family partners entered by one person)', sum(live) + halvesSum],
        ['Marked paid', sum(paid) + halvesPaid],
        ['Still to collect', sum(live) + halvesSum - sum(paid) - halvesPaid],
        [],
        ['ENTRIES PER CATEGORY', 'Entries'],
      ];
      const cats = Array.from(new Set(live.map((r) => r.Category))).sort();
      cats.forEach((c) => {
        const inCat = live.filter((r) => r.Category === c);
        const pairs = new Set(inCat.map((r) => [String(r.Player).trim().toLowerCase(), String(r.Partner).trim().toLowerCase()].sort().join('|')));
        summary.push([inCat.some((r) => r.Pairing) ? `${c}  (${pairs.size} pairs from ${inCat.length} entries)` : c, inCat.length]);
      });

      const fam = new Map<string, any>();
      live.forEach((r) => {
        const k = r['Registered by (family head)'] || r.Player;
        const f = fam.get(k) ?? { 'Family head': k, 'Qatar ID': r['Qatar ID'], 'Mobile': r.Mobile, 'Samanvayam ID': r['Samanvayam ID'], People: new Set<string>(), Entries: 0, Due: 0, Paid: 0 };
        f.People.add(r.Player); f.Entries += 1; f.Due += Number(r['Fee due (QAR)'] || 0);
        if (String(r.Payment).toLowerCase() === 'paid') f.Paid += Number(r['Fee due (QAR)'] || 0);
        if (!f.Mobile && r.Mobile) f.Mobile = r.Mobile;
        fam.set(k, f);
      });
      halves.forEach((h) => {
        const k = h['Family head'];
        const f = fam.get(k) ?? { 'Family head': k, 'Qatar ID': '', 'Mobile': '', 'Samanvayam ID': '', People: new Set<string>(), Entries: 0, Due: 0, Paid: 0 };
        f.People.add(h.Person); f.Due += Number(h.Amount || 0);
        if (String(h.Payment).toLowerCase() === 'paid') f.Paid += Number(h.Amount || 0);
        fam.set(k, f);
      });
      const famRows = Array.from(fam.values()).sort((a, b) => a['Family head'].localeCompare(b['Family head'])).map((f) => ({
        'Family head': f['Family head'], 'Qatar ID': f['Qatar ID'], 'Mobile': f.Mobile, 'Samanvayam ID': f['Samanvayam ID'],
        'People playing': f.People.size, 'Entries': f.Entries, 'Due (QAR)': f.Due, 'Paid (QAR)': f.Paid, 'Balance (QAR)': f.Due - f.Paid,
      }));

      const wb = XLSX.utils.book_new();
      const addSheet = (name: string, ws: XLSX.WorkSheet, widths?: number[]) => {
        if (widths) ws['!cols'] = widths.map((wch) => ({ wch }));
        XLSX.utils.book_append_sheet(wb, ws, name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
      };
      const tableSheet = (t: Table) => {
        const ws = XLSX.utils.json_to_sheet(t.rows, { header: t.headers });
        ws['!cols'] = t.headers.map((h) => ({ wch: Math.min(40, Math.max(h.length + 2, ...t.rows.slice(0, 200).map((r) => String(r[h] ?? '').length + 2))) }));
        ws['!freeze'] = { xSplit: 0, ySplit: 1 } as any;
        ws['!autofilter'] = { ref: ws['!ref'] ?? 'A1' };
        return ws;
      };
      const sumWs = XLSX.utils.aoa_to_sheet(summary);
      sumWs['!cols'] = [{ wch: 46 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, sumWs, 'Summary');

      // Entries: the main sheet, first useful columns only, everything else on "All details"
      const simple = ['#', 'Player', 'Category', 'Partner', 'Pairing', 'Status', 'Fee due (QAR)', 'Payment', 'Registered by (family head)', 'Mobile'];
      addSheet('Entries', tableSheet({ headers: simple, rows: reg.rows }));
      const billLines = live.filter((r) => Number(r['Fee due (QAR)']) > 0).map((r, i) => ({
        '#': i + 1, 'Family head': r['Registered by (family head)'] || r.Player, Person: r.Player, Category: r.Category,
        'Partner': r.Partner, 'Pays for': r.Partner ? 'Own half of the pair' : 'Own entry', 'Amount (QAR)': Number(r['Fee due (QAR)']), Payment: r.Payment || 'unpaid', Status: r.Status,
      }));
      halves.forEach((h) => billLines.push({ '#': billLines.length + 1, 'Family head': h['Family head'], Person: h.Person, Category: h.Category, 'Partner': h.Partner, 'Pays for': 'Partner half (family member, no entry of their own)', 'Amount (QAR)': Number(h.Amount), Payment: h.Payment || 'unpaid', Status: h.Status }));
      addSheet('Bill lines', tableSheet({ headers: ['#', 'Family head', 'Person', 'Category', 'Partner', 'Pays for', 'Amount (QAR)', 'Payment', 'Status'], rows: billLines }));
      // One bill per family: its lines (who plays what and what each line costs), then the family total
      const famBill: (string | number)[][] = [['FAMILY BILLS', '', '', '', '', '', ''], ['Family head', 'Person', 'Category', 'Partner', 'Pays for', 'Amount (QAR)', 'Payment'], []];
      const heads = Array.from(new Set(billLines.map((l) => String(l['Family head'])))).sort((a, b) => a.localeCompare(b));
      let grand = 0;
      heads.forEach((h) => {
        const lines = billLines.filter((l) => l['Family head'] === h);
        const total = lines.reduce((a, l) => a + Number(l['Amount (QAR)']), 0);
        grand += total;
        lines.forEach((l, i) => famBill.push([i === 0 ? h : '', l.Person, l.Category, l.Partner, l['Pays for'], Number(l['Amount (QAR)']), l.Payment]));
        famBill.push(['', '', '', '', `TOTAL for ${h}`, total, ''], []);
      });
      famBill.push(['', '', '', '', 'ALL FAMILIES', grand, '']);
      addSheet('Family bills', XLSX.utils.aoa_to_sheet(famBill), [26, 30, 34, 30, 44, 14, 12]);
      addSheet('Families', tableSheet({ headers: ['Family head', 'Qatar ID', 'Mobile', 'Samanvayam ID', 'People playing', 'Entries', 'Due (QAR)', 'Paid (QAR)', 'Balance (QAR)'], rows: famRows }));
      cats.forEach((c) => {
        const inCat = live.filter((r) => r.Category === c);
        if (!inCat.some((r) => r.Pairing)) {
          const rows = inCat.map((r, i) => ({ '#': i + 1, Player: r.Player, Partner: r.Partner, Status: r.Status, Gender: r.Gender, Age: r['Age (counted date)'], Mobile: r.Mobile, Payment: r.Payment }));
          addSheet(c, tableSheet({ headers: ['#', 'Player', 'Partner', 'Status', 'Gender', 'Age', 'Mobile', 'Payment'], rows }));
          return;
        }
        // Doubles: one row per pair, even when both partners filed their own entry
        const byPair = new Map<string, any[]>();
        inCat.forEach((r) => {
          const key = [String(r.Player).trim().toLowerCase(), String(r.Partner).trim().toLowerCase()].sort().join('|');
          byPair.set(key, [...(byPair.get(key) ?? []), r]);
        });
        const rows = Array.from(byPair.values()).map((g, i) => {
          const a = g[0];
          const second = g.length > 1 ? g[1] : null;
          return {
            '#': i + 1, 'Player 1': a.Player, 'Player 2': a.Partner || '(none yet)',
            'Entered by': g.map((x) => x.Player).join(' and '), Status: Array.from(new Set(g.map((x) => x.Status))).join(' / '),
            'Gender / age 1': `${a.Gender ?? ''} ${a['Age (counted date)'] ?? ''}`.trim(), 'Gender / age 2': second ? `${second.Gender ?? ''} ${second['Age (counted date)'] ?? ''}`.trim() : '',
            'Mobile 1': a.Mobile, 'Mobile 2': second?.Mobile ?? '', Payment: g.map((x) => x.Payment || 'unpaid').join(' / '), Pairing: a.Pairing,
          };
        });
        addSheet(c, tableSheet({ headers: ['#', 'Player 1', 'Player 2', 'Entered by', 'Status', 'Gender / age 1', 'Gender / age 2', 'Mobile 1', 'Mobile 2', 'Payment', 'Pairing'], rows }));
      });
      // Each doubles pair once (both partners may have filed their own entry)
      const pairMap = new Map<string, any>();
      live.filter((r) => r.Pairing).forEach((r) => {
        const key = `${r.Category}|${[String(r.Player).trim().toLowerCase(), String(r.Partner).trim().toLowerCase()].sort().join('|')}`;
        const e = pairMap.get(key) ?? { Category: r.Category, 'Player 1': r.Player, 'Player 2': r.Partner, 'Entered by': [] as string[], Status: [] as string[], Pairing: r.Pairing };
        e['Entered by'].push(r.Player); e.Status.push(r.Status);
        pairMap.set(key, e);
      });
      const pairRows = Array.from(pairMap.values()).sort((a, b) => a.Category.localeCompare(b.Category) || String(a['Player 1']).localeCompare(String(b['Player 1']))).map((e, i) => ({
        '#': i + 1, Category: e.Category, 'Player 1': e['Player 1'], 'Player 2': e['Player 2'] || '(none yet)',
        'Entered by': Array.from(new Set(e['Entered by'])).join(' and '), Status: Array.from(new Set(e.Status)).join(' / '), Pairing: e.Pairing,
      }));
      addSheet('Doubles pairs', tableSheet({ headers: ['#', 'Category', 'Player 1', 'Player 2', 'Entered by', 'Status', 'Pairing'], rows: pairRows }));
      const unpaired = live.filter((r) => r.Pairing === 'No partner yet').map((r, i) => ({ '#': i + 1, Category: r.Category, Player: r.Player, 'Says partner is': r.Partner, Mobile: r.Mobile, Status: r.Status }));
      if (unpaired.length) addSheet('Unpaired doubles', tableSheet({ headers: ['#', 'Category', 'Player', 'Says partner is', 'Mobile', 'Status'], rows: unpaired }));
      addSheet('Matches', tableSheet(mat));
      addSheet('All details', tableSheet(reg));
      addSheet('Change history', tableSheet(aud));
      addSheet('Emails sent', tableSheet(ema));

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${safeName}-full-workbook-${day}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const builders: Record<string, () => Promise<Table>> = {
      registrations: registrationsTable, matches: matchesTable, audit: auditTable, emails: emailsTable,
    };
    if (!builders[type]) return NextResponse.json({ error: 'Unknown export type' }, { status: 400 });
    const t = await builders[type]();
    const csv = toCsv(t.rows, t.headers);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}-${type}-${day}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Export failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Export failed' }, { status: 500 });
  }
}
