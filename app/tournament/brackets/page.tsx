'use client';

import { useTournamentStore } from '../store';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../types';
import type { Category } from '../types';

export default function BracketsPage() {
  const { matches, bracketGenerated, tournamentName, selectedCategories } = useTournamentStore();

  const categories: Category[] = selectedCategories.length > 0 ? selectedCategories : ['male_singles', 'female_singles', 'male_doubles', 'female_doubles', 'spouse_doubles'];

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <header className="bg-[#111827] text-white py-4 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">R</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">{tournamentName}</h1>
              <p className="text-stone-400 text-sm">Tournament Brackets</p>
            </div>
          </div>
          <nav className="hidden md:flex gap-4 text-sm">
            <a href="/tournament" className="text-stone-400 hover:text-white">Register</a>
            <a href="/tournament/brackets" className="text-white font-semibold border-b border-orange-500 pb-0.5">Brackets</a>
            <a href="/tournament/leaderboard" className="text-stone-400 hover:text-white">Leaderboard</a>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 pb-24 lg:pb-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-stone-900">Tournament Brackets</h2>
          <p className="text-stone-500">Live bracket progression</p>
        </div>

        {!bracketGenerated ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-stone-200">
            <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-stone-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
            <h3 className="text-xl font-bold text-stone-700">Brackets Not Generated Yet</h3>
            <p className="text-stone-400 mt-2">The tournament admin will generate brackets after registration closes.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {categories.map((cat) => {
              const catMatches = matches.filter((m) => m.category === cat);
              if (catMatches.length === 0) return null;
              const maxRound = Math.max(...catMatches.map((m) => m.round));

              return (
                <div key={cat} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-stone-200">
                  <div className="p-4 bg-stone-50 border-b border-stone-100">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${CATEGORY_COLORS[cat]}`}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                  </div>

                  <div className="p-4 overflow-x-auto">
                    <div className="flex gap-6 min-w-max">
                      {Array.from({ length: maxRound + 1 }, (_, r) => {
                        const roundMatches = catMatches.filter((m) => m.round === r);
                        if (roundMatches.length === 0) return null;
                        return (
                          <div key={r} className="flex flex-col gap-4">
                            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider text-center">
                              {roundMatches[0]?.roundName}
                            </p>
                            {roundMatches.map((m) => (
                              <div key={m.id} className={`w-56 border-2 rounded-xl overflow-hidden ${
                                m.status === 'in_progress' ? 'border-orange-400' :
                                m.status === 'completed' ? 'border-orange-300' : 'border-stone-200'
                              }`}>
                                <div className={`flex items-center justify-between px-3 py-2 text-sm ${
                                  m.winnerId === m.player1Id ? 'bg-orange-50 font-semibold text-orange-800' : 'text-stone-700'
                                }`}>
                                  <span className="truncate">{m.player1Name}</span>
                                  {m.sets.length > 0 && (
                                    <span className="ml-2 text-xs font-mono">
                                      {m.sets.map((s) => s.player1Score).join(' ')}
                                    </span>
                                  )}
                                </div>
                                <div className="h-px bg-stone-100" />
                                <div className={`flex items-center justify-between px-3 py-2 text-sm ${
                                  m.winnerId === m.player2Id ? 'bg-orange-50 font-semibold text-orange-800' : 'text-stone-700'
                                }`}>
                                  <span className="truncate">{m.player2Name}</span>
                                  {m.sets.length > 0 && (
                                    <span className="ml-2 text-xs font-mono">
                                      {m.sets.map((s) => s.player2Score).join(' ')}
                                    </span>
                                  )}
                                </div>
                                <div className={`px-3 py-1 text-xs text-center font-medium flex items-center justify-center gap-1 ${
                                  m.status === 'completed' ? 'bg-stone-50 text-stone-500' :
                                  m.status === 'in_progress' ? 'bg-orange-50 text-orange-700' :
                                  'bg-stone-50 text-stone-400'
                                }`}>
                                  {m.status === 'completed' ? (
                                    <>{m.winnerName}</>
                                  ) : m.status === 'in_progress' ? (
                                    <>
                                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                      In Progress
                                    </>
                                  ) : 'Upcoming'}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex justify-around py-3 text-xs">
        <a href="/tournament" className="flex flex-col items-center gap-1 text-stone-500">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          Register
        </a>
        <a href="/tournament/brackets" className="flex flex-col items-center gap-1 text-orange-600">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          Brackets
        </a>
        <a href="/tournament/leaderboard" className="flex flex-col items-center gap-1 text-stone-500">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          Leaders
        </a>
      </nav>
    </main>
  );
}
