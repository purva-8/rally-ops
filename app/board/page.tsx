import { createAdminClient } from '@/lib/supabase/admin';
import { entryLabel, isDoublesCategory } from '@/lib/categories';
import { CATEGORY_LABELS } from '../tournament/types';
import { SHEET_SLOTS, entryStatus, tidyName, type SheetMatch } from '@/lib/daySheet';
import BoardView, { type BoardSlot } from './BoardView';

// One-page sheet for the first day, made to be screenshotted and shared: the two slots, every player in each
// category in alphabetical order, and how each entry is doing (wins, out, champion) once matches are played.
// Names only (no contact details). ?event=<id> picks another event; otherwise the latest one not finished.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Schedule & results' };

const dayName = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event } = await searchParams;
  const admin = createAdminClient();
  const { data: all } = await admin.from('tournaments').select('id, name, venue, event_date, status').order('event_date', { ascending: false });
  const t = event ? all?.find((x) => x.id === event) : (all?.find((x) => x.status !== 'completed') ?? all?.[0]);
  if (!t) return <BoardView empty />;

  const cats = SHEET_SLOTS.flatMap((s) => s.categories);
  const [{ data: regs }, { data: matches }] = await Promise.all([
    admin.from('registrations').select('category, player_id, partner_id, partner_name, manual_name')
      .eq('tournament_id', t.id).eq('status', 'approved').in('category', cats),
    admin.from('matches').select('category, round, status, player1_name, player2_name, winner_name')
      .eq('tournament_id', t.id).in('category', cats),
  ]);
  const ids = [...new Set((regs ?? []).flatMap((r) => [r.player_id, r.partner_id]).filter(Boolean))] as string[];
  const { data: profiles } = ids.length ? await admin.from('player_profiles').select('id, full_name').in('id', ids) : { data: [] };
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name as string]));

  // One label per entry, the same "Player / Partner" the draws use; a pair who both filed a form is listed once
  const labels: Record<string, string[]> = {};
  const seen = new Set<string>();
  for (const r of regs ?? []) {
    if (r.player_id && r.partner_id) {
      const key = `${r.category}|${[r.player_id, r.partner_id].sort().join('|')}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    const name = (r.player_id && nameOf.get(r.player_id)) || r.manual_name || 'Player';
    const partner = (r.partner_id && nameOf.get(r.partner_id)) || r.partner_name;
    (labels[r.category] ??= []).push(entryLabel(name, partner, r.category));
  }

  const slots: BoardSlot[] = SHEET_SLOTS.map((s) => ({
    from: s.from,
    to: s.to,
    categories: s.categories.filter((c) => labels[c]?.length).map((c) => {
      const ms = (matches ?? []).filter((m) => m.category === c) as SheetMatch[];
      const n = labels[c].length;
      return {
        key: c,
        label: CATEGORY_LABELS[c] ?? c,
        doubles: isDoublesCategory(c),
        drawn: ms.length > 0,
        entries: labels[c]
          .map((l) => ({ name: tidyName(l).replace(' / ', ' & '), ...entryStatus(l, ms, n) }))
          .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })),
      };
    }),
  }));

  const first = new Date(`${t.event_date.slice(0, 10)}T12:00:00Z`);
  const second = new Date(first.getTime() + 7 * 86400000);
  return <BoardView event={{ name: t.name, venue: t.venue, day: dayName(first), nextDay: dayName(second) }} slots={slots} />;
}
