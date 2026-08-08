'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../tournament/types';
import type { Category, Match } from '../../tournament/types';

type RegEntry = {
  category: string;
  tournaments: { id: string; name: string; status: string } | null;
};

type TrackedCategory = {
  tournamentId: string;
  tournamentName: string;
  category: string;
  history: Match[];
  current: Match | null;
  eliminated: boolean;
};

function opponentOf(m: Match, userId: string) {
  return m.player1Id === userId ? (m.player2Name ?? 'BYE') : m.player1Name;
}

export default function MyMatchesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [tracked, setTracked] = useState<TrackedCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login?redirect=/my-matches'); return; }
      setUserId(user.id);

      const { data: regs } = await supabase
        .from('registrations')
        .select('category, tournaments ( id, name, status )')
        .eq('player_id', user.id)
        .eq('status', 'approved');

      const entries = (regs as unknown as RegEntry[] ?? []).filter((r) => r.tournaments);
      const tournamentIds = Array.from(new Set(entries.map((e) => e.tournaments!.id)));

      const matchesByTournament = new Map<string, Match[]>();
      await Promise.all(
        tournamentIds.map(async (tid) => {
          const res = await fetch(`/api/tournament/matches?tournamentId=${tid}`);
          const data = await res.json();
          matchesByTournament.set(tid, data.matches ?? []);
        })
      );

      const result: TrackedCategory[] = entries.map((e) => {
        const tid = e.tournaments!.id;
        const allMatches = matchesByTournament.get(tid) ?? [];
        const myMatches = allMatches
          .filter((m) => m.category === e.category && (m.player1Id === user.id || m.player2Id === user.id))
          .sort((a, b) => a.round - b.round);

        const history = myMatches.filter((m) => m.status === 'completed');
        const current = myMatches.find((m) => m.status === 'upcoming' || m.status === 'in_progress') ?? null;
        const lastCompleted = history[history.length - 1];
        const eliminated = !current && !!lastCompleted && lastCompleted.winnerId !== user.id;

        return {
          tournamentId: tid,
          tournamentName: e.tournaments!.name,
          category: e.category,
          history,
          current,
          eliminated,
        };
      });

      setTracked(result);
      setLoading(false);
    });
  }, [router]);

  if (loading || !userId) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <div className="text-white/20 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F5]">
      <div className="bg-[#111827]">
        <div className="max-w-2xl mx-auto px-4 pt-8 pb-10">
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">My Matches</h1>
          <p className="text-sm text-white/40">Who you&apos;re up against, live</p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 -mt-3 pb-10 space-y-3">
        {tracked.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-10 flex flex-col items-center text-center">
            <p className="text-sm text-stone-500 mb-1">No approved entries yet.</p>
            <p className="text-xs text-stone-400 mb-6">Once an organizer approves your registration and brackets are generated, your matches show up here.</p>
            <Link href="/my-entries" className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors">
              View My Entries
            </Link>
          </div>
        ) : (
          tracked.map((t) => (
            <div key={`${t.tournamentId}-${t.category}`} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-stone-900">{t.tournamentName}</h2>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${CATEGORY_COLORS[t.category as Category] ?? 'bg-stone-100 text-stone-600'}`}>
                    {CATEGORY_LABELS[t.category as Category] ?? t.category}
                  </span>
                </div>
                <Link href={`/events/${t.tournamentId}/results`} className="text-xs text-orange-600 font-semibold hover:text-orange-700">
                  Full bracket →
                </Link>
              </div>

              <div className="p-5">
                {t.current ? (
                  <div className="bg-stone-50 rounded-xl border border-stone-100 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {t.current.status === 'in_progress' ? (
                        <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live now
                        </span>
                      ) : (
                        <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                          Up next · {t.current.roundName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-stone-900">vs {opponentOf(t.current, userId)}</p>
                    {t.current.courtId && <p className="text-xs text-stone-400 mt-1">Court: {t.current.courtId}</p>}
                  </div>
                ) : t.eliminated ? (
                  <div className="bg-stone-50 rounded-xl border border-stone-100 p-4 text-center">
                    <p className="text-sm font-semibold text-stone-500">You&apos;ve been eliminated from this category.</p>
                  </div>
                ) : t.history.length > 0 ? (
                  <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4 text-center">
                    <p className="text-sm font-semibold text-emerald-700">You advanced! Waiting for the next round to be scheduled.</p>
                  </div>
                ) : (
                  <div className="bg-stone-50 rounded-xl border border-stone-100 p-4 text-center">
                    <p className="text-sm text-stone-400">Waiting for your first match to be scheduled.</p>
                  </div>
                )}

                {t.history.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-stone-100 space-y-2">
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Match History</p>
                    {t.history.map((m) => {
                      const iWon = m.winnerId === userId;
                      return (
                        <div key={m.id} className="flex items-center justify-between text-sm">
                          <span className="text-stone-600">{m.roundName} vs {opponentOf(m, userId)}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${iWon ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                            {iWon ? 'W' : 'L'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
