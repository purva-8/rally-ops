'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import { createClient } from '@/lib/supabase/client';
import { CATEGORY_LABELS } from '../tournament/types';
import type { Match } from '../tournament/types';
import { isDoublesCategory, sortCategories } from '@/lib/categories';
import { eventTitle } from '@/lib/eventName';
import { rankPlayers } from '@/lib/topPlayers';
import { TabStrip } from '../(player)/events/[id]/results/ResultsView';

const body = Barlow({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--lb-body' });
const display = Barlow_Condensed({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--lb-display' });

// The leaderboard's colours: terracotta and beige, gold, silver and bronze for the top three
const C = { court: '#B4532A', courtDeep: '#8F3F1E', line: '#FBF5EC', floor: '#F3EADB', ink: '#2B1D14', muted: '#7A6656', gold: '#D9962B' };
const MEDALS = ['#D9962B', '#9AA3AD', '#B07A4A'];

const short = (c: string) => (CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c);
type Kind = 'all' | 'singles' | 'doubles';

// Top players for one event: most matches won, then most points scored. Public: no login needed.
export default function TopPlayersView({ id }: { id: string }) {
  const [name, setName] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('everyone');
  const [kind, setKind] = useState<Kind>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const [{ data: t }, res] = await Promise.all([
        supabase.from('tournaments').select('name').eq('id', id).single(),
        fetch(`/api/tournament/matches?tournamentId=${id}`).then((r) => r.json()).catch(() => ({})),
      ]);
      if (t?.name) setName(t.name);
      if (res.matches) setMatches(res.matches);
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [id]);

  const fits = (c: string) => kind === 'all' || (kind === 'doubles') === isDoublesCategory(c);
  const categories = useMemo(() => sortCategories(Array.from(new Set(matches.map((m) => m.category)))), [matches]);
  const shownCats = categories.filter(fits);
  const cat = view !== 'everyone' && shownCats.includes(view) ? view : null;
  // Doubles: pairs ranked as pairs; otherwise everyone on their own line
  const pairs = !!cat ? isDoublesCategory(cat) : kind === 'doubles';
  const rows = rankPlayers(matches.filter((m) => (cat ? m.category === cat : fits(m.category))), !cat && kind !== 'doubles');
  const q = search.trim().toLowerCase();
  // Level on wins and points: the same place
  const listed = rows.map((r, i) => ({ ...r, rank: rows.findIndex((x) => x.won === r.won && x.pointsFor === r.pointsFor) + 1 || i + 1 }))
    .filter((r) => !q || r.name.toLowerCase().includes(q));

  const shell = `${body.variable} ${display.variable} [font-family:var(--lb-body)] min-h-screen`;
  if (loading) return <div className={`${shell} flex items-center justify-center`} style={{ background: C.floor, color: C.muted }}>Loading…</div>;
  const titleText = name ? eventTitle(name) : 'Tournament';
  const cut = titleText.search(/\s+Badminton Tournament$/i);

  return (
    <div className={shell} style={{ background: C.floor, color: C.ink }}>
      <header style={{ background: C.court }}>
        <div className="max-w-3xl mx-auto px-4 pt-7 pb-6">
          <div className="border-x-2 border-t-2 px-4 pt-4 pb-5 relative" style={{ borderColor: 'rgba(251,245,236,.85)' }}>
            <div className="absolute inset-y-0 left-3 right-3 border-x pointer-events-none" style={{ borderColor: 'rgba(251,245,236,.35)' }} />
            <p className="text-sm relative" style={{ color: 'rgba(251,245,236,.7)' }}>Top players</p>
            <h1 className="[font-family:var(--lb-display)] font-bold text-[min(40px,8.5vw)] sm:text-[52px] leading-[0.95] mt-1 relative" style={{ color: C.line }}>
              {cut > 0 ? <>{titleText.slice(0, cut)}<br />{titleText.slice(cut).trim()}</> : titleText}
            </h1>
            <p className="text-sm mt-3 relative flex flex-wrap gap-x-4 gap-y-1" style={{ color: 'rgba(251,245,236,.75)' }}>
              <span>Most matches won, then most points scored</span>
              <Link href={`/leaderboard?event=${id}`} className="underline" style={{ color: C.line }}>Live results →</Link>
            </p>
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-10 border-b" style={{ background: C.courtDeep, borderColor: 'rgba(251,245,236,.12)' }}>
        <TabStrip watch={shownCats.length}>
          {[{ id: 'everyone', label: kind === 'doubles' ? 'All pairs' : 'Everyone' }, ...shownCats.map((c) => ({ id: c, label: short(c) }))].map((t) => {
            const on = (cat ?? 'everyone') === t.id;
            return (
              <button key={t.id} onClick={() => setView(t.id)}
                className="shrink-0 px-3 py-1.5 rounded-md text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                style={on ? { background: C.line, color: C.court, fontWeight: 600 } : { color: 'rgba(251,245,236,.75)' }}>
                {t.label}
              </button>
            );
          })}
        </TabStrip>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-12 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          {(['all', 'singles', 'doubles'] as Kind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className="px-3 py-1.5 rounded-full text-sm border"
              style={kind === k ? { background: C.court, borderColor: C.court, color: C.line, fontWeight: 600 } : { borderColor: '#E6D9C6', background: 'white', color: C.ink }}>
              {k === 'all' ? 'Singles & doubles' : k === 'singles' ? 'Singles' : 'Doubles'}
            </button>
          ))}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a player" aria-label="Find a player"
            className="flex-1 min-w-[160px] rounded-lg border border-[#E6D9C6] px-3.5 py-2 text-[15px] bg-white focus:outline-none focus:ring-2 focus:ring-[#B4532A]" />
        </div>

        <h2 className="text-[22px] font-semibold [font-family:var(--lb-display)]">
          {cat ? short(cat) : kind === 'all' ? 'Everyone' : kind === 'singles' ? 'Everyone, singles' : 'Top pairs, all doubles'}
        </h2>

        {rows.length === 0 ? (
          <p className="text-[15px]" style={{ color: C.muted }}>No matches finished here yet. Players appear as soon as results come in.</p>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden border border-[#E6D9C6]">
            <div className="grid grid-cols-[2.25rem_1fr_2.5rem_2.5rem_3.25rem] gap-2 px-3 py-2 text-[11px] uppercase tracking-wider font-semibold border-b border-[#EFE5D6]" style={{ color: C.muted }}>
              <span>#</span><span>{pairs ? 'Pair' : 'Player'}</span><span className="text-center">Won</span><span className="text-center">Lost</span><span className="text-right">Points</span>
            </div>
            <div className="divide-y divide-[#EFE5D6]">
              {listed.map((r) => (
                <div key={r.name} className="grid grid-cols-[2.25rem_1fr_2.5rem_2.5rem_3.25rem] gap-2 px-3 py-2.5 items-center">
                  <span className="[font-family:var(--lb-display)] text-lg font-bold tabular-nums" style={{ color: r.rank <= 3 ? MEDALS[r.rank - 1] : C.muted }}>{r.rank}</span>
                  <span className="min-w-0">
                    <span className={`block text-[15px] leading-tight ${r.rank <= 3 ? 'font-semibold' : ''}`}>{r.name}</span>
                    {!cat && <span className="block text-xs truncate" style={{ color: C.muted }}>{r.categories.map(short).join(' · ')}</span>}
                  </span>
                  <span className="text-center [font-family:var(--lb-display)] text-lg font-semibold tabular-nums">{r.won}</span>
                  <span className="text-center [font-family:var(--lb-display)] text-lg tabular-nums" style={{ color: C.muted }}>{r.lost}</span>
                  <span className="text-right [font-family:var(--lb-display)] text-lg tabular-nums">{r.pointsFor}</span>
                </div>
              ))}
              {listed.length === 0 && <p className="px-3 py-3 text-sm" style={{ color: C.muted }}>Nobody by that name here.</p>}
            </div>
          </div>
        )}
        <p className="text-xs" style={{ color: C.muted }}>Byes and matches still being played don&apos;t count. Points: every rally point won in finished matches.</p>
      </main>
    </div>
  );
}
