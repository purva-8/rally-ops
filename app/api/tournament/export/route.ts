import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toCsv } from '@/lib/csv';
import { formatDate, formatDateTime } from '@/lib/format';
import { ageOn, categoryFee, categoryLabel } from '@/lib/categories';

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
    .from('tournaments').select('id, name, created_by, event_date, entry_fee').eq('id', tournamentId).single();
  if (!tournament || tournament.created_by !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    let csv = '';

    if (type === 'registrations') {
      const regs = await fetchAll<any>((from, to) =>
        supabase.from('registrations').select('*').eq('tournament_id', tournamentId)
          .order('created_at', { ascending: true }).range(from, to));

      const ids = Array.from(new Set(regs.map((r) => r.player_id).filter(Boolean)));
      const profiles = new Map<string, any>();
      const loadProfiles = async (list: string[]) => {
        for (let i = 0; i < list.length; i += 100) {
          const { data } = await supabase.from('player_profiles')
            .select('id, full_name, gender, dob, mobile, qid, parent_id, relationship, samanvayam_member')
            .in('id', list.slice(i, i + 100));
          (data ?? []).forEach((p) => profiles.set(p.id, p));
        }
      };
      await loadProfiles(ids);
      await loadProfiles(Array.from(new Set(Array.from(profiles.values()).map((p) => p.parent_id).filter((id) => id && !profiles.has(id)))));

      const rows = regs.map((r, i) => {
        const p = profiles.get(r.player_id);
        const parent = p?.parent_id ? profiles.get(p.parent_id) : null;
        return {
          '#': i + 1,
          'Registration ref (Qatar ID)': p?.qid ?? r.manual_qid ?? r.registration_code ?? '',
          'Registration code': r.registration_code ?? '',
          'Player': p?.full_name ?? r.manual_name ?? '',
          'Registered by (member)': parent ? parent.full_name : (p?.full_name ?? ''),
          'Relationship': p?.parent_id ? (p?.relationship ?? '') : 'Self',
          'Samanvayam member': p?.samanvayam_member ? 'Yes' : 'No',
          'Gender': p?.gender ?? '',
          'Date of birth': formatDate(p?.dob),
          'Age on event day': p?.dob && tournament.event_date ? ageOn(p.dob, tournament.event_date) : '',
          'Mobile': p?.mobile ?? r.manual_mobile ?? parent?.mobile ?? '',
          'Category': categoryLabel(r.category),
          'Partner': r.partner_name ?? '',
          'Status': r.status,
          'Fee due (QAR)': categoryFee(r.category, Number(tournament.entry_fee ?? 0)),
          'Payment': r.payment_status ?? '',
          'Payment ref': r.payment_ref ?? '',
          'Emergency contact': r.emergency_contact ?? '',
          'Notes': r.notes ?? '',
          'Registered at': formatDateTime(r.created_at),
        };
      });
      csv = toCsv(rows, [
        '#', 'Registration ref (Qatar ID)', 'Registration code', 'Player', 'Registered by (member)', 'Relationship',
        'Samanvayam member', 'Gender', 'Date of birth', 'Age on event day', 'Mobile', 'Category', 'Partner', 'Status',
        'Fee due (QAR)', 'Payment', 'Payment ref', 'Emergency contact', 'Notes', 'Registered at',
      ]);
    } else if (type === 'matches') {
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
        'Court': m.court_id ?? '',
        'Referee': m.referee_name ?? '',
        'Scheduled': formatDateTime(m.scheduled_at),
        'Status': m.status,
        'Scores': sets.filter((s) => s.match_id === m.id).map((s) => `${s.player1_score}-${s.player2_score}`).join(', '),
        'Winner': m.winner_name ?? '',
        'Completed': formatDateTime(m.completed_at),
      }));
      csv = toCsv(rows, ['#', 'Category', 'Round', 'Player 1', 'Player 2', 'Court', 'Referee', 'Scheduled', 'Status', 'Scores', 'Winner', 'Completed']);
    } else if (type === 'audit') {
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
      csv = toCsv(rows, ['When', 'Action', 'Table', 'Row id', 'Actor', 'Before', 'After']);
    } else {
      return NextResponse.json({ error: 'Unknown export type' }, { status: 400 });
    }

    const safeName = tournament.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Export failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Export failed' }, { status: 500 });
  }
}
