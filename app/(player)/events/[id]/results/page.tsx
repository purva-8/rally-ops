'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../../../tournament/types';
import type { Category, Match } from '../../../../tournament/types';

type Tournament = { id: string; name: string };

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <span className="text-[11px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium">Final</span>;
  if (status === 'in_progress') return (
    <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live
    </span>
  );
  return <span className="text-[11px] bg-stone-50 text-stone-400 border border-stone-200 px-2 py-0.5 rounded-full font-medium">Upcoming</span>;
}

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string>('all');

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const [{ data: t }, matchesRes] = await Promise.all([
        supabase.from('tournaments').select('id, name').eq('id', id).single(),
        fetch(`/api/tournament/matches?tournamentId=${id}`).then((r) => r.json()),
      ]);
      setTournament(t);
      setMatches(matchesRes.matches ?? []);
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [id]);

  const categories = Array.from(new Set(matches.map((m) => m.category))) as Category[];
  const displayMatches = selectedCat === 'all' ? matches : matches.filter((m) => m.category === selectedCat);

  const champions = categories
    .map((cat) => {
      const catMatches = matches.filter((m) => m.category === cat);
      const maxRound = catMatches.reduce((max, m) => Math.max(max, m.round), 0);
      const final = catMatches.find((m) => m.round === maxRound && m.status === 'completed' && !m.isBye);
      return final?.winnerName ? { cat, name: final.winnerName } : null;
    })
    .filter(Boolean) as { cat: Category; name: string }[];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F4F5] flex items-center justify-center">
        <div className="text-stone-300 text-sm">Loading results...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F5]">
      <div className="bg-[#111827]">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
          <Link href={`/events/${id}`} className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors mb-4">
            ← Back to tournament
          </Link>
          <h1 className="text-xl font-extrabold text-white tracking-tight">{tournament?.name}</h1>
          <p className="text-sm text-white/40 mt-1">Live results, updates every 15s</p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 -mt-3 pb-10">
        {champions.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 mb-4">
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Champions</h2>
            <div className="space-y-2">
              {champions.map(({ cat, name }) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[cat]}`}>{CATEGORY_LABELS[cat]}</span>
                  <span className="font-bold text-stone-900">🏆 {name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button onClick={() => setSelectedCat('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCat === 'all' ? 'bg-[#111827] text-white' : 'bg-white border border-stone-200 text-stone-500'
            }`}>
            All
          </button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setSelectedCat(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCat === cat ? 'bg-[#111827] text-white' : 'bg-white border border-stone-200 text-stone-500'
              }`}>
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {displayMatches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-stone-400 text-sm">
            Brackets haven&apos;t been generated yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayMatches.map((m) => (
              <div key={m.id} className={`bg-white rounded-xl border p-4 ${m.status === 'in_progress' ? 'border-emerald-200' : 'border-stone-200'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[m.category]}`}>{CATEGORY_LABELS[m.category]}</span>
                  <span className="text-[11px] text-stone-400">{m.roundName}</span>
                  <StatusBadge status={m.status} />
                </div>
                <p className="font-semibold text-stone-900 text-sm">
                  {m.isBye ? (
                    <>{m.player1Name} <span className="text-stone-400 font-normal">(bye)</span></>
                  ) : (
                    <>{m.player1Name} <span className="text-stone-300 font-normal">vs</span> {m.player2Name}</>
                  )}
                </p>
                {!m.isBye && m.sets.length > 0 && (
                  <p className="text-sm text-stone-500 mt-1">
                    {m.sets.map((s, i) => <span key={i}>{s.player1Score}–{s.player2Score}{i < m.sets.length - 1 ? ', ' : ''}</span>)}
                    {m.winnerName && <> · <strong className="text-orange-600">{m.winnerName}</strong></>}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
