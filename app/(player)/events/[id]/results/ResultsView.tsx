'use client';

import { useEffect, useMemo, useState } from 'react';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import { createClient } from '@/lib/supabase/client';
import { CATEGORY_LABELS } from '../../../../tournament/types';
import type { Category, Match } from '../../../../tournament/types';
import { sortCategories } from '@/lib/categories';
import { eventTitle } from '@/lib/eventName';

const body = Barlow({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--lb-body' });
const display = Barlow_Condensed({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--lb-display' });

// Terracotta and beige, gold for whoever won, green for a match on court
const C = { court: '#B4532A', courtDeep: '#8F3F1E', line: '#FBF5EC', floor: '#F3EADB', ink: '#2B1D14', muted: '#7A6656', gold: '#D9962B', live: '#2E9E5B' };

type Tournament = { id: string; name: string; venue: string | null };

const shortCat = (c: string) => CATEGORY_LABELS[c] ?? c;
const roundTitle = (name: string, n: number) => (n > 1 && /final$/i.test(name) ? `${name}s` : name);

// One player's (or pair's) line on a scorecard: name, then each game's points
function Side({ name, games, won, decided }: { name: string; games: (number | null)[]; won: boolean; decided: boolean }) {
  return (
    <div className="flex items-stretch">
      <span className="w-1 shrink-0 rounded-full mr-3" style={{ background: won ? C.gold : 'transparent' }} />
      <span className={`flex-1 min-w-0 py-1.5 text-[15px] leading-tight ${won ? 'font-semibold' : decided ? 'opacity-60' : ''}`} style={{ color: C.ink }}>
        {name}
      </span>
      <span className="flex shrink-0 [font-family:var(--lb-display)] tabular-nums text-lg">
        {games.map((g, i) => (
          <span key={i} className="w-8 text-center py-1" style={{ color: g === null ? 'transparent' : C.ink, fontWeight: g !== null && won ? 700 : 500 }}>
            {g ?? 0}
          </span>
        ))}
      </span>
    </div>
  );
}

function Scorecard({ m, highlight, quiet }: { m: Match; highlight: (s?: string) => boolean; quiet?: boolean }) {
  const live = m.status === 'in_progress';
  const decided = m.status === 'completed';
  if (m.isBye) {
    return (
      <div className="py-2.5 pl-7 pr-3 text-[15px]" style={{ color: C.muted }}>
        <span className={highlight(m.player1Name) ? 'font-semibold' : ''} style={{ color: C.ink }}>{m.player1Name}</span> goes straight through (bye)
      </div>
    );
  }
  const games = [0, 1, 2].map((i) => m.sets[i]);
  const shown = Math.max(1, m.sets.length);
  const p1won = decided && m.winnerName === m.player1Name;
  const p2won = decided && m.winnerName === m.player2Name;
  return (
    <div className={`px-3 py-2 ${highlight(m.player1Name) || highlight(m.player2Name) ? 'bg-[#FFF1D6]' : ''}`}>
      <Side name={m.player1Name} games={games.slice(0, shown).map((g) => (g ? g.player1Score : null))} won={p1won} decided={decided} />
      <Side name={m.player2Name ?? ''} games={games.slice(0, shown).map((g) => (g ? g.player2Score : null))} won={p2won} decided={decided} />
      {!quiet && (live || m.status === 'upcoming') && (
        <p className="text-xs mt-0.5 pl-4 flex items-center gap-1.5" style={{ color: live ? C.live : C.muted }}>
          {live && <span className="w-1.5 h-1.5 rounded-full motion-safe:animate-pulse" style={{ background: C.live }} />}
          {live ? 'On court now' : 'To be played'}
        </p>
      )}
    </div>
  );
}

// Live results for one event: what's on court, champions, and every draw round by round. Public: no login needed.
export default function ResultsView({ id }: { id: string }) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [view, setView] = useState<string>('latest');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const [{ data: t }, matchesRes] = await Promise.all([
        supabase.from('tournaments').select('id, name, venue').eq('id', id).single(),
        fetch(`/api/tournament/matches?tournamentId=${id}`).then((r) => r.json()).catch(() => ({})),
      ]);
      setTournament(t);
      if (matchesRes.matches) { setMatches(matchesRes.matches); setUpdated(new Date()); }
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [id]);

  const categories = useMemo(() => sortCategories(Array.from(new Set(matches.map((m) => m.category)))) as Category[], [matches]);
  const q = search.trim().toLowerCase();
  const highlight = (s?: string) => !!q && !!s && s.toLowerCase().includes(q);
  const hits = (m: Match) => !q || highlight(m.player1Name) || highlight(m.player2Name);
  const playable = matches.filter((m) => !m.isBye);
  const live = playable.filter((m) => m.status === 'in_progress');
  const recent = playable.filter((m) => m.status === 'completed')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, 8);
  const champions = categories.flatMap((cat) => {
    const final = matches.find((m) => m.category === cat && m.roundName === 'Final' && m.status === 'completed' && !m.isBye);
    return final?.winnerName ? [{ cat, name: final.winnerName, runnerUp: final.winnerName === final.player1Name ? final.player2Name : final.player1Name }] : [];
  });

  const shell = `${body.variable} ${display.variable} [font-family:var(--lb-body)] min-h-screen`;

  if (loading) {
    return <div className={`${shell} flex items-center justify-center`} style={{ background: C.floor, color: C.muted }}>Loading results…</div>;
  }

  const sectionTitle = 'text-[22px] font-semibold [font-family:var(--lb-display)] mb-2';
  const panel = 'bg-white rounded-xl overflow-hidden divide-y divide-[#EFE5D6] border border-[#E6D9C6]';

  return (
    <div className={shell} style={{ background: C.floor, color: C.ink }}>
      {/* Header: terracotta, framed by a badminton court's doubles and singles side lines */}
      <header style={{ background: C.court }}>
        <div className="max-w-3xl mx-auto px-4 pt-7 pb-6">
          <div className="border-x-2 border-t-2 px-4 pt-4 pb-5 relative" style={{ borderColor: 'rgba(251,245,236,.85)' }}>
            <div className="absolute inset-y-0 left-3 right-3 border-x pointer-events-none" style={{ borderColor: 'rgba(251,245,236,.35)' }} />
            <p className="text-sm relative" style={{ color: 'rgba(251,245,236,.7)' }}>Live results{tournament?.venue ? `, ${tournament.venue}` : ''}</p>
            <h1 className="[font-family:var(--lb-display)] font-bold text-[40px] sm:text-[52px] leading-[0.95] mt-1 relative" style={{ color: C.line }}>
              {tournament?.name ? eventTitle(tournament.name) : 'Tournament'}
            </h1>
            <p className="text-sm mt-3 relative flex flex-wrap gap-x-4 gap-y-1" style={{ color: 'rgba(251,245,236,.75)' }}>
              {live.length > 0 && (
                <span className="flex items-center gap-1.5" style={{ color: C.line }}>
                  <span className="w-2 h-2 rounded-full motion-safe:animate-pulse" style={{ background: C.live }} />
                  {live.length} on court now
                </span>
              )}
              <span>{playable.filter((m) => m.status === 'completed').length} of {playable.length} matches played</span>
              {updated && <span>Updated {updated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
            </p>
          </div>
        </div>
      </header>

      {/* What to look at: the latest, or one category's draw */}
      <nav className="sticky top-0 z-10 border-b" style={{ background: C.courtDeep, borderColor: 'rgba(251,245,236,.12)' }}>
        <div className="max-w-3xl mx-auto px-4 flex gap-1 overflow-x-auto py-2">
          {[{ id: 'latest', label: 'Latest' }, ...categories.map((c) => ({ id: c, label: shortCat(c) }))].map((t) => (
            <button key={t.id} onClick={() => setView(t.id)}
              className="shrink-0 px-3 py-1.5 rounded-md text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={view === t.id ? { background: C.line, color: C.court, fontWeight: 600 } : { color: 'rgba(251,245,236,.75)' }}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-12 space-y-8">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a player"
          aria-label="Find a player"
          className="w-full rounded-lg border border-[#E6D9C6] px-3.5 py-2.5 text-[15px] bg-white focus:outline-none focus:ring-2 focus:ring-[#B4532A]"
          style={{ color: C.ink }} />

        {matches.length === 0 && (
          <p className="text-[15px]" style={{ color: C.muted }}>The draws haven&apos;t been made yet. Results appear here as soon as matches are played.</p>
        )}

        {view === 'latest' && matches.length > 0 && (
          <>
            {live.filter(hits).length > 0 && (
              <section>
                <h2 className={sectionTitle}>On court now</h2>
                <div className={panel}>
                  {live.filter(hits).map((m) => (
                    <div key={m.id}>
                      <p className="px-4 pt-2.5 text-xs" style={{ color: C.muted }}>{shortCat(m.category)}, {m.roundName.toLowerCase()}</p>
                      <Scorecard m={m} highlight={highlight} quiet />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {champions.length > 0 && !q && (
              <section>
                <h2 className={sectionTitle}>Champions</h2>
                <div className="grid sm:grid-cols-2 gap-2">
                  {champions.map((c) => (
                    <div key={c.cat} className="rounded-xl px-4 py-3 border-l-4 bg-white" style={{ borderColor: C.gold }}>
                      <p className="text-xs" style={{ color: C.muted }}>{shortCat(c.cat)}</p>
                      <p className="[font-family:var(--lb-display)] text-2xl font-semibold leading-tight">{c.name}</p>
                      {c.runnerUp && <p className="text-xs mt-0.5" style={{ color: C.muted }}>Runner-up: {c.runnerUp}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className={sectionTitle}>Latest results</h2>
              {recent.filter(hits).length === 0 ? (
                <p className="text-[15px]" style={{ color: C.muted }}>{q ? 'No results for that name yet. Pick a category above to see their draw.' : 'No matches finished yet.'}</p>
              ) : (
                <div className={panel}>
                  {recent.filter(hits).map((m) => (
                    <div key={m.id}>
                      <p className="px-4 pt-2.5 text-xs" style={{ color: C.muted }}>{shortCat(m.category)}, {m.roundName.toLowerCase()}</p>
                      <Scorecard m={m} highlight={highlight} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {view !== 'latest' && (() => {
          const catMatches = matches.filter((m) => m.category === view);
          const rounds = Array.from(new Set(catMatches.map((m) => m.round))).sort((a, b) => a - b);
          const champ = champions.find((c) => c.cat === view);
          return (
            <section className="space-y-6">
              <div>
                <h2 className="[font-family:var(--lb-display)] text-3xl font-bold leading-tight">{shortCat(view)}</h2>
                {champ && <p className="text-[15px] mt-1">Champion: <b>{champ.name}</b></p>}
              </div>
              {rounds.map((r) => {
                const inRound = catMatches.filter((m) => m.round === r).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
                const shown = inRound.filter(hits);
                if (!shown.length) return null;
                return (
                  <div key={r}>
                    <h3 className="text-[17px] font-semibold [font-family:var(--lb-display)] mb-1.5" style={{ color: C.court }}>
                      {roundTitle(inRound[0].roundName, inRound.filter((m) => !m.isBye).length)}
                    </h3>
                    <div className={panel}>
                      {shown.map((m) => <Scorecard key={m.id} m={m} highlight={highlight} />)}
                    </div>
                  </div>
                );
              })}
              {q && !catMatches.some(hits) && <p className="text-[15px]" style={{ color: C.muted }}>Nobody by that name in this category.</p>}
            </section>
          );
        })()}
      </main>
    </div>
  );
}
